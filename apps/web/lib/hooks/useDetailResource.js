import { useCallback } from "react";
import useSWR from "swr";
import { fetchWithAuth, swrFetcher } from "../api";

/**
 * Hook for loading a single API resource by URL.
 *
 * Backed by SWR: responses are cached by URL across the whole app, so
 * revisiting a page (back button, tab switch, re-navigation) renders the last
 * value instantly and revalidates in the background instead of re-fetching from
 * scratch. Skips the fetch when `url` is falsy (e.g. before `router.query.id`
 * is available).
 *
 * The public contract is unchanged from the pre-SWR implementation:
 *   - `data`     — the unwrapped resource (`json.data` when present, else the body)
 *   - `setData`  — optimistic local update (writes the SWR cache, no revalidation)
 *   - `loading`  — true until the first response resolves (and while url is falsy)
 *   - `error`    — string message, or null
 *   - `refresh`  — re-fetch and revalidate the cache
 *
 * @param {string|null|undefined} url  API URL to fetch, or falsy to skip
 * @param {function} [fetchFn]        Custom fetch function (default: fetchWithAuth)
 * @returns {{ data: any, setData: function, loading: boolean, error: string|null, refresh: function }}
 *
 * @example
 *   const { id } = useRouter().query;
 *   const { data: recon, setData: setRecon, loading, error, refresh } =
 *     useDetailResource(id ? `/api/charge-reconciliations/${id}` : null);
 */
export function useDetailResource(url, fetchFn = fetchWithAuth) {
  const fetcher = useCallback((key) => swrFetcher(key, fetchFn), [fetchFn]);

  const { data, error, isLoading, mutate } = useSWR(url || null, fetcher);

  // Optimistic local update — mirrors the old useState setter. Accepts a value
  // or an updater function; writes the cache without triggering a revalidation.
  const setData = useCallback(
    (next) => mutate(next, { revalidate: false }),
    [mutate],
  );

  // Re-fetch and revalidate.
  const refresh = useCallback(() => mutate(), [mutate]);

  return {
    data: data ?? null,
    setData,
    // Preserve the historical "loading until first response, and while url is
    // falsy" semantics (SWR reports isLoading=false for a null key).
    loading: url ? isLoading : true,
    error: error ? error.message || "Failed to load" : null,
    refresh,
  };
}
