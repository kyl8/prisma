import type { AppUser } from "../../data";
import type { ActivityDTO, ActivityFilters, ActivityOptions } from "./activityTypes";
import { API_BASE, apiHeaders } from "../../api/config";

// Ponte exclusiva do protótipo: em produção, a sessão Auth.js identifica o viewer.
async function request<T>(path: string, viewer: AppUser): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: apiHeaders(),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? "Não foi possível carregar as atividades.");
  return body as T;
}

function query(filters: ActivityFilters, cursor?: string) {
  const params = new URLSearchParams({ limit: "30" });
  if (filters.companyId) params.set("companyId", filters.companyId);
  if (filters.actorId) params.set("actorId", filters.actorId);
  if (filters.category) params.set("category", filters.category);
  if (filters.date === "Mais antigas") params.set("order", "asc");
  if (filters.date === "Hoje") params.set("from", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
  if (filters.date === "Últimos 7 dias") params.set("from", new Date(Date.now() - 7 * 86400000).toISOString());
  if (filters.date === "Últimos 30 dias") params.set("from", new Date(Date.now() - 30 * 86400000).toISOString());
  if (cursor) params.set("cursor", cursor);
  return params.toString();
}

export function getActivityOptions(viewer: AppUser, companyId?: string) {
  const params = new URLSearchParams({ filters: "true" });
  if (companyId) params.set("companyId", companyId);
  return request<ActivityOptions>(`/api/activities?${params}`, viewer);
}

export function getActivities(viewer: AppUser, filters: ActivityFilters, cursor?: string) {
  return request<{ items: ActivityDTO[]; nextCursor: string | null }>(`/api/activities?${query(filters, cursor)}`, viewer);
}
