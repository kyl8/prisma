import { API_BASE, apiHeaders } from "../../api/config";

export type IntegrationStatus = { enabled: boolean; configured: boolean; environment: "validation" | "production"; status: string; readOnly: boolean; lastSync: string | null; lastSyncStatus: string | null };
export type OfficialProduct = { productCode: string; version: string; denomination: string | null; ncm: string | null; status: string | null; internalProductCodes: string[] };
export type OfficialOperator = { operatorCode: string; version: string | null; country: string | null; name: string | null; tin: string | null };
export type OfficialCatalog<T> = { items: T[]; cacheStatus: string; fetchedAt: string | null; environment: string };
export type Requirement = { code: string; name: string; description: string | null; required: boolean; conditional: boolean; conditions: unknown; domain: unknown[] };
export type Comparison = {
  id: string; environment: string; fetchedAt: string; cacheStatus: string; officialProduct: OfficialProduct; officialOperator: OfficialOperator | null;
  diff: { conflictCount: number; requiresReview: boolean; inactive: boolean; fields: { field: string; label: string; localValue: unknown; officialValue: unknown; status: "matching" | "conflict" | "official_only" | "local_only" }[]; missingRequiredAttributes: Requirement[]; conditionalAttributes: Requirement[] };
};
export type NcmLookup = { ncm: string; cacheStatus: string; fetchedAt: string; officialNcm: { description: string | null; validFrom: string | null; validTo: string | null } | null };
export type AttributeLookup = { ncm: string; cacheStatus: string; fetchedAt: string; requirements: Requirement[] };
export type SyncInput = { productCode: string; version: string; force: boolean; operationMode: string; foreignOperator?: { code: string; country: string; version: string } };

const base = "/api/integrations/siscomex";
async function request<T>(path: string, input?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${base}${path}`, { method: input === undefined ? "GET" : "POST", headers: apiHeaders(), credentials: "include", signal, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error("Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || "Não foi possível consultar o SISCOMEX. Tente novamente.");
  return body as T;
}
const companyPath = (companyId: string) => `/companies/${encodeURIComponent(companyId)}`;
export const getSiscomexStatus = (signal?: AbortSignal) => request<IntegrationStatus>("/status", undefined, signal);
export const testSiscomexConnection = () => request<{ status: string; environment: string }>("/test", {});
export const getOfficialCatalog = (companyId: string, refresh = false, signal?: AbortSignal) => request<OfficialCatalog<OfficialProduct>>(`${companyPath(companyId)}/catalog`, refresh ? {} : undefined, signal);
export const getOfficialOperators = (companyId: string, refresh = false, signal?: AbortSignal) => request<OfficialCatalog<OfficialOperator>>(`${companyPath(companyId)}/operators`, refresh ? {} : undefined, signal);
export const getComparison = (companyId: string, productId: string, signal?: AbortSignal) => request<Comparison | null>(`${companyPath(companyId)}/products/${encodeURIComponent(productId)}`, undefined, signal);
export const compareWithSiscomex = (companyId: string, productId: string, input: SyncInput) => request<Comparison>(`${companyPath(companyId)}/products/${encodeURIComponent(productId)}`, input);
export const lookupNcm = (companyId: string, ncm: string) => request<NcmLookup>(`${companyPath(companyId)}/ncm/${encodeURIComponent(ncm)}`);
export const lookupAttributes = (companyId: string, ncm: string, operationMode: string) => request<AttributeLookup>(`${companyPath(companyId)}/attributes/${encodeURIComponent(ncm)}?operationMode=${operationMode}`);
