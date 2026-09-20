import type { CatalogRequest, Product } from "../../../data";
import { API_BASE, apiHeaders } from "../../../api/config";

// Em produção, o reverse proxy pode servir a API no mesmo domínio; durante o
// protótipo local o backend Next roda em :3000.

export type PublicCatalogRequest = Omit<CatalogRequest, "token" | "companyId" | "createdByUserId" | "productIds" | "createdAt"> & {
  token?: string;
  createdAt: string;
  company: { id: string; name: string; cnpj?: string };
  requestedBy: { name?: string; title?: string };
  recipient: { name: string; email: string };
  products: Product[];
};

function mapProduct(product: any): Product {
  const backendStatus = String(product.status ?? "").toLowerCase();
  const status = backendStatus.includes("review") || backendStatus.includes("sent") ? "sent_for_review" : backendStatus.includes("correction") ? "correction_requested" : backendStatus.includes("approved") ? "approved" : "needs_you";
  return {
    id: product.id,
    companyId: "backend",
    name: product.name,
    sku: product.sku,
    ncm: product.ncm,
    completeness: product.completeness,
    ncmDescription: "",
    status,
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
  const response = await fetch(`${API_BASE}${path}`, { ...init, credentials: "include", headers: apiHeaders(init?.headers) });
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
export type WorkspaceCompany = BackendCompany & {
  totalProducts: number; completeProducts: number; completeness: number; pendingCount: number; awaitingImporter: number; inReview: number; pendingResponses: number;
  requests: { id: string; status: string; kind: string; recipientName: string; recipientEmail: string; createdAt: string; productCount: number }[];
  activity: { id: string; type: string; createdAt: string; actorName: string; productName: string | null; requestId: string | null }[];
};

export async function listCatalogCompanies() {
  return request<BackendCompany[]>("/api/companies");
}

export async function listWorkspaceCompanies() {
  return request<WorkspaceCompany[]>("/api/workspace/companies");
}

export async function createWorkspaceCompany(input: { enterprise: string; cnpj: string; name: string; email: string }) {
  return request<WorkspaceCompany>("/api/workspace/companies", { method: "POST", body: JSON.stringify(input) });
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

export async function updateBackendCatalogRequest(requestId: string, input: Record<string, unknown>) {
  return request<any>(`/api/catalog-requests/${encodeURIComponent(requestId)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function cancelBackendCatalogRequest(requestId: string) {
  return request<{ id: string; status: "cancelled" }>(`/api/catalog-requests/${encodeURIComponent(requestId)}`, { method: "DELETE" });
}

export async function deleteBackendCatalogRequest(requestId: string) {
  return request<{ id: string }>(`/api/catalog-requests/${encodeURIComponent(requestId)}?permanent=true`, { method: "DELETE" });
}

export async function approveBackendCatalogRequest(requestId: string) {
  return request<{ id: string; status: "completed" }>(`/api/catalog-requests/${encodeURIComponent(requestId)}`, { method: "POST" });
}

export async function getCatalogRequestReview(requestId: string) {
  return request<{ id: string; status: string; products: { id: string; name: string; sku: string; attributes: { key: string; label: string; value: string; status: string }[] }[] }>(`/api/catalog-requests/${encodeURIComponent(requestId)}`);
}

export async function rejectBackendCatalogRequest(requestId: string, note: string) {
  return request<{ id: string; status: "in_progress"; note: string }>(`/api/catalog-requests/${encodeURIComponent(requestId)}/reject`, { method: "POST", body: JSON.stringify({ note }) });
}

export type CatalogImportRow = {
  name: string;
  code: string;
  ncm: string;
  fields: { key: string; label: string; type: "text" | "number" | "date" | "boolean"; value: string }[];
};

export async function importBackendCatalog(companyId: string, rows: CatalogImportRow[]) {
  return request<{ total: number; created: number; updated: number; imported: { id: string; name: string; code: string; created: boolean }[] }>("/api/catalog-import", { method: "POST", body: JSON.stringify({ companyId, rows }) });
}

export type CreateCatalogProductInput = {
  companyId: string;
  name: string;
  code: string;
  ncm: string;
  fields: { key: string; label: string; type: "text" | "number" | "date" | "boolean"; value: string; required: boolean }[];
  submitForReview: boolean;
};

export async function createBackendProduct(input: CreateCatalogProductInput) {
  return request<{ id: string; name: string; code: string; ncm: string; status: string; completeness: string }>("/api/products", { method: "POST", body: JSON.stringify(input) });
}

export async function deleteBackendProduct(productId: string) {
  return request<{ id: string }>(`/api/products/${encodeURIComponent(productId)}`, { method: "DELETE" });
}
