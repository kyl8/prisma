import { SiscomexError } from "./siscomex.client";

export type CacheState = "FRESH" | "STALE" | "UNAVAILABLE";
export const freshness = (fetchedAt: Date | string, ttl: number, now = Date.now()): CacheState => {
  const age = now - new Date(fetchedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < ttl * 1000 ? "FRESH" : "STALE";
};

/** Stale evidence is only a fallback for outages/rate limits, never denied access. */
export async function cachedResource<T extends { fetchedAt: Date | string }>(options: {
  latest: T | null; ttl: number; force?: boolean; now?: number; fetchAndSave: () => Promise<T>;
}) {
  if (!options.force && options.latest && freshness(options.latest.fetchedAt, options.ttl, options.now) === "FRESH") {
    return { snapshot: options.latest, cacheStatus: "FRESH" as CacheState, fromCache: true, unavailableReason: null };
  }
  try { return { snapshot: await options.fetchAndSave(), cacheStatus: "FRESH" as CacheState, fromCache: false, unavailableReason: null }; }
  catch (error) {
    if (options.latest && error instanceof SiscomexError && (error.retryable || error.code === "SISCOMEX_RATE_LIMITED")) {
      return { snapshot: options.latest, cacheStatus: "STALE" as CacheState, fromCache: true, unavailableReason: error.code };
    }
    throw error;
  }
}
