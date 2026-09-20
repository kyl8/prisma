// Adapted from kyl8/prisma@063b063 (read-only SISCOMEX integration).
// Credentials and rotating session headers never leave the server process.
export type SiscomexConfig = ReturnType<typeof loadSiscomexConfig>;
export type Transport = typeof fetch;

export class SiscomexError extends Error {
  constructor(public code: string, message: string, public status = 502, public retryable = false) {
    super(message);
    this.name = "SiscomexError";
  }
}

export function loadSiscomexConfig(env: Record<string, string | undefined> = process.env) {
  const boolean = (key: string) => {
    const value = env[key]?.trim().toLowerCase();
    if (!value || ["false", "0", "no"].includes(value)) return false;
    if (["true", "1", "yes"].includes(value)) return true;
    throw new SiscomexError("SISCOMEX_CONFIG_INVALID", `Revise ${key} no servidor.`, 503);
  };
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const value = env[key] ? Number(env[key]) : fallback;
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new SiscomexError("SISCOMEX_CONFIG_INVALID", `Revise ${key} no servidor.`, 503);
    }
    return value;
  };
  const environment = env.SISCOMEX_ENV || "validation";
  if (environment !== "validation" && environment !== "production") {
    throw new SiscomexError("SISCOMEX_CONFIG_INVALID", "SISCOMEX_ENV deve ser validation ou production.", 503);
  }
  const enabled = boolean("SISCOMEX_ENABLED");
  if (enabled && environment === "production" && !boolean("SISCOMEX_ALLOW_PRODUCTION")) {
    throw new SiscomexError("SISCOMEX_CONFIG_INVALID", "Produção exige SISCOMEX_ALLOW_PRODUCTION=true no servidor.", 503);
  }
  const clientId = env.SISCOMEX_CLIENT_ID?.trim() || "";
  const clientSecret = env.SISCOMEX_CLIENT_SECRET?.trim() || "";
  return {
    enabled, environment, clientId, clientSecret, configured: Boolean(clientId && clientSecret),
    baseUrl: environment === "production" ? "https://portalunico.siscomex.gov.br" : "https://val.portalunico.siscomex.gov.br",
    roleType: env.SISCOMEX_ROLE_TYPE?.trim() || "IMPEXP",
    cacheTtlSeconds: integer("SISCOMEX_CACHE_TTL_SECONDS", 3600, 1, 86400),
    timeoutMs: integer("SISCOMEX_TIMEOUT_MS", 15000, 1, 30000),
    maxServerRetries: integer("SISCOMEX_MAX_SERVER_RETRIES", 1, 0, 2),
  };
}

type Session = { authorization: string; csrfToken: string; expiresAt: number };
type RequestOptions = { path: string; query?: Record<string, string | boolean | undefined>; authenticated?: boolean };

export function digits(value: string, lengths: number[], label: string) {
  // Formatting is accepted, arbitrary letters/path fragments are not silently stripped.
  if (!/^[\d.\s/-]+$/.test(value)) throw new SiscomexError("INVALID_INPUT", `${label} inválido.`, 422);
  const normalized = value.replace(/\D/g, "");
  if (!lengths.includes(normalized.length)) throw new SiscomexError("INVALID_INPUT", `${label} inválido.`, 422);
  return normalized;
}

export function productVersion(value: string) {
  if (!/^\d+(?:\.\d+)*$/.test(value) || value.length > 8) throw new SiscomexError("INVALID_INPUT", "Informe uma versão válida, como 1 ou 1.0.", 422);
  return value;
}

export function redactPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactPayload);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key,
    /authorization|token|client.?secret|client.?id|access.?key|password|passphrase/i.test(key) ? "[REDACTED]" : redactPayload(entry),
  ]));
}

function upstreamError(status: number, payload: unknown) {
  const externalCode = payload && typeof payload === "object" && "code" in payload ? payload.code : null;
  if (status === 429 || externalCode === "PUCX-ER1001") return new SiscomexError("SISCOMEX_RATE_LIMITED", "Limite de consultas do SISCOMEX atingido. Aguarde antes de tentar novamente.", 429);
  if (status === 401 || status === 403) return new SiscomexError("SISCOMEX_ACCESS_DENIED", "O SISCOMEX recusou o acesso. Verifique as chaves, o perfil e a permissão para esta empresa.", 502);
  if (status === 404) return new SiscomexError("SISCOMEX_NOT_FOUND", "O registro não foi encontrado no SISCOMEX. Confira o código e a versão.", 404);
  return new SiscomexError("SISCOMEX_UNAVAILABLE", "Não foi possível consultar o SISCOMEX. Tente novamente mais tarde.", 502, [500, 502, 503, 504].includes(status));
}

/** GET-only client; the sole POST is the official access-key authentication. */
export class SiscomexClient {
  private session: Session | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly config: SiscomexConfig, private transport: Transport = fetch, private now = Date.now) {}

  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.then(work, work);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private assertEnabled(authenticated: boolean) {
    if (!this.config.enabled || (authenticated && !this.config.configured)) {
      throw new SiscomexError("SISCOMEX_NOT_CONFIGURED", "A integração SISCOMEX ainda não está habilitada com as chaves de acesso no servidor.", 503);
    }
  }

  private rotate(response: Response) {
    if (!this.session) return;
    const expiration = Number(response.headers.get("x-csrf-expiration"));
    this.session = {
      authorization: response.headers.get("set-token") ?? this.session.authorization,
      csrfToken: response.headers.get("x-csrf-token") ?? this.session.csrfToken,
      expiresAt: expiration > this.now() ? expiration : this.session.expiresAt,
    };
  }

  private async read(response: Response): Promise<unknown> {
    if (response.status === 204) return null;
    // Limit untrusted upstream responses, including a chunked nomenclature download.
    const reader = response.body?.getReader();
    if (!reader) return null;
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 20 * 1024 * 1024) {
        await reader.cancel();
        throw new SiscomexError("SISCOMEX_RESPONSE_TOO_LARGE", "A resposta do SISCOMEX excedeu o limite de processamento.");
      }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    if (!text.trim()) return null;
    try { return JSON.parse(text) as unknown; }
    catch {
      if (!response.ok) return null;
      throw new SiscomexError("SISCOMEX_INVALID_RESPONSE", "O SISCOMEX retornou uma resposta inválida. Tente novamente.");
    }
  }

  private async authenticate(signal: AbortSignal) {
    if (this.session && this.session.expiresAt - this.now() > 5000) return this.session;
    const response = await this.transport(`${this.config.baseUrl}/portal/api/autenticar/chave-acesso`, {
      method: "POST", redirect: "error", cache: "no-store", signal,
      headers: { "Client-Id": this.config.clientId, "Client-Secret": this.config.clientSecret, "Role-Type": this.config.roleType, Accept: "application/json" },
    });
    const payload = await this.read(response);
    if (!response.ok) throw upstreamError(response.status, payload);
    const authorization = response.headers.get("set-token");
    const csrfToken = response.headers.get("x-csrf-token");
    if (!authorization || !csrfToken) throw new SiscomexError("SISCOMEX_INVALID_AUTH_RESPONSE", "O SISCOMEX não retornou uma sessão válida.");
    const expiration = Number(response.headers.get("x-csrf-expiration"));
    this.session = { authorization, csrfToken, expiresAt: expiration > this.now() ? expiration : this.now() + 55 * 60 * 1000 };
    return this.session;
  }

  private async timed<T>(work: (signal: AbortSignal) => Promise<T>) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try { return await work(controller.signal); }
    catch (error) {
      if (controller.signal.aborted) throw new SiscomexError("SISCOMEX_TIMEOUT", "O SISCOMEX demorou para responder. Tente novamente.", 504, true);
      if (error instanceof SiscomexError) throw error;
      // Never relay upstream bodies, URLs, credentials or low-level transport messages.
      throw new SiscomexError("SISCOMEX_UNAVAILABLE", "Não foi possível conectar ao SISCOMEX. Tente novamente mais tarde.", 502, true);
    } finally { clearTimeout(timeout); }
  }

  async testConnection() {
    this.assertEnabled(true);
    return this.exclusive(() => this.timed(async (signal) => {
      await this.authenticate(signal);
      return { status: "CONNECTED" as const, environment: this.config.environment, readOnly: true as const };
    }));
  }

  async request({ path, query = {}, authenticated = true }: RequestOptions): Promise<unknown> {
    this.assertEnabled(authenticated);
    if (!/^\/(catp\/api\/ext\/|cadatributos\/api\/ext\/|classif\/api\/publico\/)/.test(path) || /[\\?#]/.test(path) || path.includes("..")) {
      throw new SiscomexError("INVALID_INPUT", "Endpoint SISCOMEX inválido.", 422);
    }
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => { if (value !== undefined) params.set(key, String(value)); });
    const run = async () => {
      let authRetries = 0;
      let serverRetries = 0;
      while (true) {
        const result = await this.timed(async (signal) => {
          const session = authenticated ? await this.authenticate(signal) : null;
          const response = await this.transport(`${this.config.baseUrl}${path}${params.size ? `?${params}` : ""}`, {
            method: "GET", redirect: "error", cache: "no-store", signal,
            headers: { Accept: "application/json", ...(session ? { Authorization: session.authorization, "X-CSRF-Token": session.csrfToken } : {}) },
          });
          if (authenticated) this.rotate(response);
          return { response, payload: await this.read(response) };
        });
        if (result.response.ok) return result.payload;
        if (result.response.status === 401 && authenticated && authRetries++ === 0) { this.session = null; continue; }
        const error = upstreamError(result.response.status, result.payload);
        if (error.retryable && serverRetries++ < this.config.maxServerRetries) {
          await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** (serverRetries - 1)));
          continue;
        }
        throw error;
      }
    };
    return authenticated ? this.exclusive(run) : run();
  }

  listProducts(root: string) {
    return this.request({ path: "/catp/api/ext/produto", query: { cpfCnpjRaiz: digits(root, [8, 11], "Raiz do CNPJ") } });
  }
  getProduct(root: string, code: string, version: string) {
    return this.request({ path: `/catp/api/ext/produto/${digits(root, [8, 11], "Raiz do CNPJ")}/${digits(code, [1,2,3,4,5,6,7,8,9,10], "Código do produto")}/${productVersion(version)}` });
  }
  exportProducts(root: string, includeInactive = false) {
    return this.request({ path: `/catp/api/ext/produto/exportar/${digits(root, [8,11], "Raiz do CNPJ")}/${includeInactive}` });
  }
  listOperators(root: string) {
    return this.request({ path: "/catp/api/ext/operador-estrangeiro", query: { cpfCnpjRaiz: digits(root, [8,11], "Raiz do CNPJ") } });
  }
  getOperator(root: string, country: string, code: string, version: string) {
    if (!/^[A-Za-z]{2}$/.test(country) || !/^[A-Za-z0-9._-]{1,35}$/.test(code)) throw new SiscomexError("INVALID_INPUT", "Operador estrangeiro inválido.", 422);
    return this.request({ path: `/catp/api/ext/operador-estrangeiro/${digits(root, [8,11], "Raiz do CNPJ")}/${country.toUpperCase()}/${encodeURIComponent(code)}/${productVersion(version)}` });
  }
  getAttributes(ncm: string, operationMode = "IMPORTACAO") {
    return this.request({ path: `/cadatributos/api/ext/atributo-ncm/${digits(ncm, [8], "NCM")}`, query: { modalidade: operationMode } });
  }
  getNomenclature() {
    return this.request({ path: "/classif/api/publico/nomenclatura/download/json", authenticated: false });
  }
}

let sharedClient: SiscomexClient | undefined;
export function getSiscomexClient() {
  const config = loadSiscomexConfig();
  if (!sharedClient || JSON.stringify(sharedClient.config) !== JSON.stringify(config)) sharedClient = new SiscomexClient(config);
  return sharedClient;
}
