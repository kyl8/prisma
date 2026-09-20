import { IntegrationError } from "./integration.errors";

type JsonRecord = Record<string, unknown>;

const DEFAULT_API_URL = "https://api.logcomex.ai/v1";
const DEFAULT_AGENT_ID = "0ec81103-b3c8-4760-9475-84faadf2f23a";
const DEFAULT_PROMPT_ID = "58480681-893e-46af-bacc-3d213f9debdc";

function configuredBaseUrl() {
  return (process.env.LOGCOMEX_API_URL?.trim() || DEFAULT_API_URL).replace(/\/$/, "");
}

function authHeaders() {
  const key = process.env.LOGCOMEX_API_KEY?.trim();
  if (!key) return {};
  const header = process.env.LOGCOMEX_API_KEY_HEADER?.trim() || "Authorization";
  return { [header]: header.toLowerCase() === "authorization" ? `Bearer ${key}` : key };
}

function endpoint(path: string) {
  const base = configuredBaseUrl();
  if (!base) throw new IntegrationError("LOGCOMEX_NOT_CONFIGURED", "A integração com a Logcomex ainda não foi configurada.", 503);
  return new URL(path.startsWith("/") ? path : `/${path}`, `${base}/`).toString();
}

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(endpoint(path), {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(Number(process.env.LOGCOMEX_TIMEOUT_MS ?? 10000)),
  });
  const text = await response.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    throw new IntegrationError("LOGCOMEX_REQUEST_FAILED", `A Logcomex respondeu com HTTP ${response.status}.`, 502);
  }
  return body;
}

export function getLogcomexStatus() {
  return {
    configured: Boolean(process.env.LOGCOMEX_API_KEY?.trim()),
    baseUrlConfigured: Boolean(configuredBaseUrl()),
    apiKeyConfigured: Boolean(process.env.LOGCOMEX_API_KEY?.trim()),
  };
}

export async function queryLogcomex(input: JsonRecord) {
  return executeLogcomexAgent({
    arquivo_documento: JSON.stringify(input),
    tipo_documento: "auto",
    etapa_operacao: "cadastro_catalogo",
    objetivo_analise: String(input.objetivo_analise ?? input.query ?? "Analisar o catálogo e apontar lacunas."),
    campos_prioritarios: String(input.campos_prioritarios ?? "descrição, NCM, fabricante, modelo, SKU, EAN, origem"),
    documentos_confronto: String(input.documentos_confronto ?? "catálogo persistido do PRISMA"),
    incluir_sugestoes_preditivas: "sim",
    nivel_detalhe: "completo",
  });
}

export function isLogcomexAgentConfigured() {
  return Boolean(process.env.LOGCOMEX_API_KEY?.trim());
}

async function authorizedFetch(url: string, init: RequestInit, timeoutMs?: number) {
  const configuredTimeout = Number(process.env.LOGCOMEX_TIMEOUT_MS ?? 30000);
  const requestTimeout = Math.max(1000, Math.min(configuredTimeout, timeoutMs ?? configuredTimeout));
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LOGCOMEX_API_KEY?.trim() ?? ""}`,
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(requestTimeout),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export async function executeLogcomexAgent(input: JsonRecord) {
  if (!isLogcomexAgentConfigured()) throw new IntegrationError("LOGCOMEX_NOT_CONFIGURED", "A integração com a Logcomex ainda não foi configurada.", 503);
  const agentId = process.env.LOGCOMEX_AGENT_ID?.trim() || DEFAULT_AGENT_ID;
  const promptId = process.env.LOGCOMEX_PROMPT_ID?.trim() || DEFAULT_PROMPT_ID;
  const executeUrl = `${configuredBaseUrl()}/agent-api-execute/${agentId}/${promptId}`;
  const deadline = Date.now() + Number(process.env.LOGCOMEX_MAX_WAIT_MS ?? 120000);
  let { response, payload } = await authorizedFetch(executeUrl, { method: "POST", body: JSON.stringify(input) }, Math.max(1000, deadline - Date.now()));
  if (!response.ok && response.status !== 202) throw new IntegrationError(`LOGCOMEX_HTTP_${response.status}`, `A Logcomex respondeu com HTTP ${response.status}.`, 502);
  if (response.status !== 202) return payload;
  const requestId = typeof payload?.request_id === "string" ? payload.request_id : "";
  if (!requestId) throw new IntegrationError("LOGCOMEX_MISSING_REQUEST_ID", "A Logcomex aceitou a execução, mas não devolveu request_id.");
  const pollAfter = Number(payload?.meta?.poll_after_ms ?? 2000);
  for (;;) {
    if (Date.now() >= deadline) throw new IntegrationError("LOGCOMEX_TIMEOUT", "A anÃ¡lise da Logcomex demorou mais que o limite de resposta. Tente novamente.", 504);
    await new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(pollAfter, 500), 5000)));
    if (Date.now() >= deadline) throw new IntegrationError("LOGCOMEX_TIMEOUT", "A anÃ¡lise da Logcomex demorou mais que o limite de resposta. Tente novamente.", 504);
    ({ response, payload } = await authorizedFetch(`${configuredBaseUrl()}/agent-api-execute/${requestId}`, { method: "GET" }, Math.max(1000, deadline - Date.now())));
    if (response.status === 202) continue;
    if (!response.ok) throw new IntegrationError(`LOGCOMEX_REPLAY_HTTP_${response.status}`, `A Logcomex falhou ao recuperar a execução (${response.status}).`);
    return payload;
  }
  throw new IntegrationError("LOGCOMEX_TIMEOUT", "A análise da Logcomex ainda está em processamento. Tente novamente em instantes.", 504);
}
