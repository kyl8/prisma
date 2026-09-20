import prisma from "@/lib/prisma";
import { IntegrationError } from "../integration/integration.errors";
import { executeLogcomexAgent, getLogcomexStatus, isLogcomexAgentConfigured } from "../integration/logcomex.client";

const PRISMA_POLICY = [
  "Separe fatos, inferências e dados ausentes.",
  "Vincule conclusões às evidências disponíveis.",
  "Trate NCM declarada como informação não validada.",
  "Não tome decisões fiscais, legais ou financeiras pelo usuário.",
  "Quando não houver dados suficientes, declare a limitação e indique a próxima ação segura.",
].join(" ");

type AssistantInput = { message: string; companyId?: string; productId?: string };

function textFromAgent(payload: unknown) {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return "";
  const value = payload as Record<string, unknown>;
  for (const key of ["answer", "message", "response", "output_text", "text"]) {
    if (typeof value[key] === "string" && value[key].trim()) return value[key].trim();
  }
  if (Array.isArray(value.output)) {
    const chunks = value.output.flatMap((item) => item && typeof item === "object" && Array.isArray((item as any).content) ? (item as any).content : []);
    const text = chunks.map((item: any) => item?.text).filter(Boolean).join("\n");
    if (text) return text;
  }
  return "";
}

async function fetchCompany(userId: string, companyId?: string) {
  const company = companyId
    ? await (prisma as any).importer.findFirst({ where: { id: companyId, userId }, include: { user: { select: { enterprise: true, cnpj: true } }, products: { include: { fields: true } }, catalogRequests: true } })
    : await (prisma as any).importer.findFirst({ where: { userId }, include: { user: { select: { enterprise: true, cnpj: true } }, products: { include: { fields: true } }, catalogRequests: true } });
  if (company) return company;
  if (companyId) {
    const access = await (prisma as any).customsBrokerCompanyAccess.findFirst({ where: { companyId, customsBroker: { userId } } });
    if (access) return (prisma as any).importer.findUnique({ where: { id: companyId }, include: { user: { select: { enterprise: true, cnpj: true } }, products: { include: { fields: true } }, catalogRequests: true } });
  }
  throw new IntegrationError("COMPANY_NOT_FOUND", "Você não tem acesso a este catálogo.", 404);
}

function buildContext(company: any, productId?: string) {
  const products = (company.products ?? []).map((product: any) => ({
    id: product.id,
    name: product.name,
    code: product.code,
    ncm: product.ncm,
    status: product.status,
    completeness: product.completeness,
    fields: (product.fields ?? []).map((field: any) => ({ key: field.title, label: field.label, required: field.required })),
  }));
  return {
    company: { id: company.id, name: company.user?.enterprise ?? company.id, cnpj: company.user?.cnpj ?? null },
    selectedProduct: productId ? products.find((product: any) => product.id === productId) ?? null : null,
    products,
    openRequests: (company.catalogRequests ?? []).filter((request: any) => !["completed", "cancelled", "expired"].includes(request.status)).map((request: any) => ({ id: request.id, status: request.status, recipientName: request.recipientName })),
  };
}

async function askRemoteAgent(input: AssistantInput, context: any, logcomex: unknown) {
  const url = process.env.PRISMA_AI_AGENT_URL?.trim();
  if (!url) return "";
  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(process.env.PRISMA_AI_AGENT_TOKEN ? { Authorization: `Bearer ${process.env.PRISMA_AI_AGENT_TOKEN}` } : {}) },
    body: JSON.stringify({ message: input.message, context, logcomex, policy: PRISMA_POLICY }),
    signal: AbortSignal.timeout(Number(process.env.PRISMA_AI_AGENT_TIMEOUT_MS ?? 20000)),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new IntegrationError("AI_AGENT_REQUEST_FAILED", `O agente de IA respondeu com HTTP ${response.status}.`, 502);
  return textFromAgent(payload);
}

function formatLogcomexAnswer(payload: any) {
  const data = payload?.data ?? payload;
  const summary = data?.resumo_executivo?.avaliacao_geral ?? data?.resumo_executivo?.descricao_resumo ?? "";
  const gaps = (data?.lacunas_criticas ?? data?.divergencias_lacunas_criticas ?? []).slice(0, 4).map((item: any) => item.lacuna_ou_divergencia ?? item.lacuna ?? item.ponto ?? item.impacto).filter(Boolean);
  const queue = data?.fila_saneamento ?? data?.fila_preditiva_saneamento ?? data?.sugestoes_preditivas_fila_saneamento?.itens ?? [];
  const next = queue.slice(0, 4).map((item: any) => item.proxima_acao ?? item.acao ?? item.pendencia).filter(Boolean);
  const cleanSummary = String(summary).replace(/^An\u00e1lise conclu\u00edda pela Logcomex\.?\s*/i, "").trim();
  return [cleanSummary, gaps.length ? `Lacunas ou divergências: ${gaps.join("; ")}.` : "", next.length ? `Próximos passos: ${next.join("; ")}.` : ""].filter(Boolean).join("\n\n");
}

export async function askAssistant(userId: string, input: AssistantInput) {
  const message = input.message.trim();
  if (!message) throw new IntegrationError("EMPTY_MESSAGE", "Digite uma pergunta para o assistente.", 422);
  const company = await fetchCompany(userId, input.companyId);
  const context = buildContext(company, input.productId);
  let logcomex: unknown = null;
  let integrationWarning = "";
  const logcomexConfigured = getLogcomexStatus().configured;
  if (isLogcomexAgentConfigured()) {
    const agentInput = {
      arquivo_documento: message,
      tipo_documento: "auto",
      etapa_operacao: "cadastro_catalogo",
      objetivo_analise: message,
      campos_prioritarios: "descricao, NCM, fabricante, modelo, SKU, EAN, campos obrigatorios, pendencias",
      documentos_confronto: context.selectedProduct ? JSON.stringify(context.selectedProduct) : "nenhum documento adicional",
      incluir_sugestoes_preditivas: "nao",
      nivel_detalhe: "resumido",
      async: true,
    };
    try {
      logcomex = await executeLogcomexAgent(agentInput);
    } catch (error) {
      if (error instanceof IntegrationError && error.code === "LOGCOMEX_HTTP_422") {
        try {
          logcomex = await executeLogcomexAgent({ ...agentInput, incluir_sugestoes_preditivas: "nao", nivel_detalhe: "resumido", objetivo_analise: `${message}. Responda com checklist objetivo e JSON valido.` });
        } catch (retryError) {
          if (retryError instanceof IntegrationError) integrationWarning = retryError.message;
          else integrationWarning = "A Logcomex nÃ£o retornou a anÃ¡lise a tempo.";
        }
      } else if (error instanceof IntegrationError) {
        integrationWarning = error.message;
      } else {
        integrationWarning = "A integraÃ§Ã£o externa estÃ¡ indisponÃ­vel no momento.";
      }
    }
  }
  const answer = logcomex ? formatLogcomexAnswer(logcomex) : await askRemoteAgent(input, context, logcomex);
  if (!answer) throw new IntegrationError("ASSISTANT_UNAVAILABLE", integrationWarning || "A Logcomex nao retornou uma resposta. Tente novamente em instantes.", 502);
  return { answer, provider: logcomex ? "logcomex" : "agent", warning: integrationWarning || undefined, logcomex: { configured: logcomexConfigured, consulted: Boolean(logcomex) }, context: { companyId: company.id, productCount: context.products.length } };
}
