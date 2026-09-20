import type { AppNotification, AppUser, Product } from "../data";
import { API_BASE, apiHeaders } from "./config";

type Profile = { id: string; name: string | null; email: string; role: "importer"; company: { id: string; name: string; cnpj: string }; dispatcher: { id: string; name: string | null; email: string; company: string } | null };

async function request<T>(path: string, init: RequestInit = {}, user?: AppUser | null): Promise<T> {
  const headers = apiHeaders(init.headers);
  const response = await fetch(`${API_BASE}${path}`, { ...init, credentials: "include", headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(response.status === 401 ? "Sua sessão expirou. Faça login novamente." : response.status === 403 ? "Você não tem acesso a estes dados." : response.status === 404 ? "Produto não encontrado." : body.message ?? "Não foi possível carregar os dados.");
    Object.assign(error, { status: response.status, code: body.code });
    throw error;
  }
  return body as T;
}

function mapProduct(product: any): Product {
  return { ...product, sku: product.sku ?? product.code, corrections: product.corrections ?? [], attributes: (product.attributes ?? []).map((attribute: any) => ({ ...attribute, group: attribute.group ?? "personalizados", value: attribute.value ?? "" })) };
}

export async function getImporterProfile(user?: AppUser | null) {
  const profile = await request<Profile>("/api/importer/profile", {}, user);
  return { ...profile, name: profile.name ?? "Importador", initials: (profile.name ?? "I").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(), companyId: profile.company.id } as AppUser & { company: Profile["company"]; dispatcher: Profile["dispatcher"] };
}

export async function signInWithCredentials(email: string, password: string) {
  const csrfResponse = await fetch(`${API_BASE}/api/auth/csrf`, { credentials: "include" });
  const { csrfToken } = await csrfResponse.json();
  const body = new URLSearchParams({ csrfToken, email, password, callbackUrl: `${window.location.origin}/app`, redirect: "false" });
  const response = await fetch(`${API_BASE}/api/auth/callback/credentials`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error("E-mail ou senha inválidos.");
  return request<{ id: string; name: string | null; email: string; role: "importer" | "dispatcher" }>("/api/me");
}

export async function signOutFromCredentials() {
  const csrfResponse = await fetch(`${API_BASE}/api/auth/csrf`, { credentials: "include" });
  const { csrfToken } = await csrfResponse.json();
  await fetch(`${API_BASE}/api/auth/signout`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken, callbackUrl: `${window.location.origin}/app`, redirect: "false" }) });
}

export async function getImporterProducts(user?: AppUser | null) {
  const response = await request<{ items: any[] }>("/api/importer/products", {}, user);
  return response.items.map(mapProduct);
}

export async function getImporterProduct(id: string, user?: AppUser | null) {
  return mapProduct(await request<any>(`/api/importer/products/${encodeURIComponent(id)}`, {}, user));
}

export async function saveImporterProduct(id: string, attributes: Record<string, string>, submitForReview = false, user?: AppUser | null) {
  return mapProduct(await request<any>(`/api/importer/products/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ attributes, submitForReview }) }, user));
}

export async function getImporterNotifications(user?: AppUser | null) {
  const response = await request<{ items: any[] }>("/api/notifications", {}, user);
  return response.items.map((item): AppNotification => ({ id: item.id, companyId: "", kind: String(item.action).toLowerCase().includes("corre") ? "correction" : String(item.action).toLowerCase().includes("aprov") ? "approved" : "request", title: item.action, description: item.description, productId: item.entityType === "product" ? item.entityId : undefined, read: Boolean(item.readAt), createdAt: new Date(item.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).replace(/\./g, "") }));
}

export function markImporterNotificationRead(id: string, user?: AppUser | null) {
  return request(`/api/notifications/${encodeURIComponent(id)}`, { method: "PATCH" }, user);
}

export function markAllImporterNotificationsRead(user?: AppUser | null) {
  return request("/api/notifications/read-all", { method: "POST" }, user);
}
