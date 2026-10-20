"use client";

import { useEffect, useRef, useState } from "react";

type State<T> = { data: T | null; error: unknown; loading: boolean; deps: unknown[] };

const sameDeps = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

/**
 * Minimal data-loading hook: { data, error, loading, reload }.
 * Re-runs when `deps` change; ignores responses from superseded requests.
 * `loading` is also true while the data on screen belongs to older deps (e.g.
 * the previous date range), so callers can show that it is being replaced.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true, deps });
  const [version, setVersion] = useState(0);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    let cancelled = false;
    const requested = deps;
    (async () => {
      try {
        const data = await fnRef.current();
        if (!cancelled) setState({ data, error: null, loading: false, deps: requested });
      } catch (error) {
        if (!cancelled) setState((s) => ({ data: s.data, error, loading: false, deps: requested }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);

  const reload = () => {
    setState((s) => ({ ...s, error: null, loading: true }));
    setVersion((v) => v + 1);
  };

  const { deps: loadedDeps, ...rest } = state;
  return { ...rest, loading: rest.loading || !sameDeps(loadedDeps, deps), reload };
}
