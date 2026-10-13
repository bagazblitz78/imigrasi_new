import { useCallback, useEffect, useRef, useState } from "react";

// Tiny server-state cache. Avoids refetching identical data when navigating
// between pages and keeps stale results visible while refreshing.
const cache = new Map();

export function invalidateQueries(prefix) {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function useApiQuery(cacheKey, fetcher, options = {}) {
  const { deps = [], enabled = true, staleTime = 30_000 } = options;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const initial = cache.get(cacheKey);
  const [state, setState] = useState({
    data: initial?.data ?? null,
    error: null,
    loading: enabled && !initial,
    refreshing: Boolean(initial),
  });

  const load = useCallback(
    async (signal, { force = false } = {}) => {
      const cached = cache.get(cacheKey);
      if (!force && cached && Date.now() - cached.time < staleTime) {
        setState({ data: cached.data, error: null, loading: false, refreshing: false });
        return cached.data;
      }
      setState((s) => ({
        data: s.data,
        error: null,
        loading: s.data == null,
        refreshing: s.data != null,
      }));
      try {
        const data = await fetcherRef.current(signal);
        cache.set(cacheKey, { data, time: Date.now() });
        if (!signal?.aborted) {
          setState({ data, error: null, loading: false, refreshing: false });
        }
        return data;
      } catch (err) {
        if (err?.name === "AbortError" || err?.name === "TimeoutError") return;
        if (!signal?.aborted) {
          setState((s) => ({ ...s, error: err, loading: false, refreshing: false }));
        }
        throw err;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cacheKey, staleTime],
  );

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    load(controller.signal).catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled, ...deps]);

  const refetch = useCallback((opts) => load(undefined, { force: true, ...opts }), [load]);

  return { ...state, refetch, setData: (data) => setState((s) => ({ ...s, data })) };
}

export function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
