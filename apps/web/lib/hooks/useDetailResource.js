import { useState, useEffect, useCallback } from "react";
import { fetchWithAuth } from "../api";

/**
 * Hook for loading a single API resource by URL.
 *
 * Manages loading / error / data states with automatic fetch on mount
 * and whenever `url` changes. Skips the fetch when `url` is falsy
 * (e.g. before `router.query.id` is available).
 *
 * Response unwrapping: if the JSON body has a `.data` property it is
 * used as the resource value; otherwise the full body is used.
 * This covers both `{ data: { ... } }` and `{ id, status, ... }` shapes.
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFn(url);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.error?.message || json.message || "Failed to load"
        );
      }
      setData(json.data !== undefined ? json.data : json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [url, fetchFn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, setData, loading, error, refresh };
}
