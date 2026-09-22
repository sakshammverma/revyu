"use client";

import { useEffect, useRef, useState } from "react";

type State<T> = { data: T | null; error: unknown; loading: boolean };

/**
 * Minimal data-loading hook: { data, error, loading, reload }.
 * Re-runs when `deps` change; ignores responses from superseded requests.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true });
  const [version, setVersion] = useState(0);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fnRef.current();
        if (!cancelled) setState({ data, error: null, loading: false });
      } catch (error) {
        if (!cancelled) setState((s) => ({ data: s.data, error, loading: false }));
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

  return { ...state, reload };
}
