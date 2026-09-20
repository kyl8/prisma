import { API_BASE, apiHeaders } from "../../api/config";

async function request<T>(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 130000);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      credentials: "include",
      headers: apiHeaders(init?.headers),
    });
  } catch (error) {
    if (error && typeof error === "object" && "name" in error && error.name === "AbortError") {
      throw new Error("A resposta demorou mais que o esperado. Tente novamente.");
    }
    throw new Error("NÃ£o foi possÃ­vel conectar ao assistente. Verifique sua conexÃ£o e tente novamente.");
  } finally {
    window.clearTimeout(timeout);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? "Não foi possível consultar o assistente.");
  return body as T;
}

export type AssistantResponse = {
  answer: string;
  provider: "logcomex" | "agent";
  warning?: string;
  logcomex: { configured: boolean; consulted: boolean };
  context: { companyId: string; productCount: number };
};

export function askAssistant(input: { message: string; companyId?: string; productId?: string }) {
  return request<AssistantResponse>("/api/assistant", { method: "POST", body: JSON.stringify(input) });
}

export function getLogcomexHealth() {
  return request<{ configured: boolean; baseUrlConfigured: boolean; apiKeyConfigured: boolean }>("/api/integrations/logcomex/health");
}
