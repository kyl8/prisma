/** Runtime configuration shared by every API client in the Vite app. */
// Keep browser requests same-origin by default. Vite proxies /api to the
// backend in development, avoiding session-cookie/CORS issues between ports.
export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function apiHeaders(init?: HeadersInit) {
  const headers = new Headers(init);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return headers;
}
