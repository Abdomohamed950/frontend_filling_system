import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiErrorMessage } from "@/lib/api";

/**
 * GETs a resource with proper loading/error state, request cancellation and
 * an explicit `refetch`.
 *
 * The pages this replaces each ran `useEffect(..., [items])` and called
 * `setItems` inside — an unbounded request loop that hammered the backend
 * for as long as the screen stayed open. Here the effect depends on the
 * *serialized* query, so a fetch only reruns when the query truly changes
 * and never on its own result.
 */
export function useApi(path, { params, enabled = true, fallback = [] } = {}) {
  const [data, setData] = useState(fallback);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  // A stable string dependency: `{a:1}` re-renders to a new object every
  // time, but its serialization is unchanged.
  const paramsKey = JSON.stringify(params ?? null);

  // Identifies the query currently in flight. Loading is derived by comparing
  // it against the last settled one, so the effect never writes state merely
  // to raise a flag on the way in.
  const requestKey = `${path}|${paramsKey}|${reloadToken}`;
  const [settledKey, setSettledKey] = useState(null);

  // Held in a ref so changing the fallback's identity never triggers a fetch.
  // Synced in an effect — mutating a ref during render is unsafe.
  const fallbackRef = useRef(fallback);
  useEffect(() => {
    fallbackRef.current = fallback;
  });

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    let active = true;

    api
      .get(path, { params: JSON.parse(paramsKey) ?? undefined, signal: controller.signal })
      .then((response) => {
        if (!active) return;
        setData(response.data ?? fallbackRef.current);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        const message = apiErrorMessage(err);
        if (message === null) return; // cancelled by a newer request
        setError(message);
        setData(fallbackRef.current);
      })
      .finally(() => {
        if (active) setSettledKey(requestKey);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [path, paramsKey, enabled, requestKey]);

  const refetch = useCallback(() => setReloadToken((n) => n + 1), []);

  // A disabled query is never "loading".
  const loading = Boolean(enabled) && settledKey !== requestKey;

  return { data, loading, error, refetch, setData };
}
