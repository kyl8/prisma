import type { CatalogRequest, Product } from "../../../data";

// Em produção, o reverse proxy pode servir a API no mesmo domínio; durante o
// protótipo local o backend Next roda em :3000.
const API_BASE = "http://localhost:3000";

export type PublicCatalogRequest = Omit<CatalogRequest, "token" | "companyId" | "createdByUserId" | "productIds" | "createdAt"> & {
  token?: string;
  createdAt: string;
  company: { id: string; name: string; cnpj?: string };
  requestedBy: { name?: string; title?: string };
  recipient: { name: string; email: string };
  products: Product[];
};

function mapProduct(product: any): Product {
  return {
    id: product.id,
    companyId: "backend",
    name: product.name,
    sku: product.sku,
    ncm: product.ncm,
    completeness: product.completeness,
    ncmDescription: "",
    status: product.status === "Aprovado" ? "approved" : "needs_you",
    updatedAt: new Date().toISOString(),
    corrections: [],
    attributes: product.attributes.map((attribute: any) => ({
      key: attribute.key,
      label: attribute.label,
      value: attribute.value ?? "",
      required: Boolean(attribute.required),
      group: "personalizados",
      note: attribute.correctionNote,
    })),
  };
}

function mapRequest(payload: any): PublicCatalogRequest {
  return {
    id: payload.id,
    status: payload.status,
    kind: payload.kind,
    message: payload.message,
    expiresAt: payload.expiresAt,
    createdAt: payload.createdAt,
    company: payload.company,
    requestedBy: payload.requestedBy,
    recipient: payload.recipient,
    products: (payload.products ?? []).map(mapProduct),
    token: payload.token,
  } as PublicCatalogRequest;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { ...init, credentials: "include", headers: { "Content-Type": "application/json", "x-prisma-demo-email": "carlos.menezes@portoseguro-despachos.com.br", ...(init?.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.message ?? "Não foi possível concluir a operação."), body);
  return body as T;
}

export async function getPublicCatalogRequest(token: string) {
  return mapRequest(await request(`/api/catalog-requests/public/${encodeURIComponent(token)}`));
}

export async function startCatalogRequest(token: string) {
  return mapRequest(await request(`/api/catalog-requests/public/${encodeURIComponent(token)}/start`, { method: "PATCH" }));
}

export async function saveCatalogProduct(token: string, productId: string, attributes: Record<string, string>) {
  return mapRequest(await request(`/api/catalog-requests/public/${encodeURIComponent(token)}/products/${encodeURIComponent(productId)}`, { method: "PATCH", body: JSON.stringify({ attributes }) }));
}

export async function submitCatalogRequest(token: string) {
  return mapRequest(await request(`/api/catalog-requests/public/${encodeURIComponent(token)}/submit`, { method: "POST" }));
}

export type BackendCompany = { id: string; name: string; cnpj: string; contactName?: string; contactEmail?: string; products: Product[] };

export async function listCatalogCompanies() {
  return request<BackendCompany[]>("/api/companies");
}

export async function listCompanyCatalogRequests(companyId: string) {
  return request<any[]>(`/api/companies/${encodeURIComponent(companyId)}/catalog-requests`);
}

export async function createBackendCatalogRequest(input: Record<string, unknown>) {
  return request<any>("/api/catalog-requests", { method: "POST", body: JSON.stringify(input) });
}

export async function reissueCatalogRequest(requestId: string) {
  return request<any>(`/api/catalog-requests/${encodeURIComponent(requestId)}/reissue`, { method: "POST" });
}
