"use client";

import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

// Glides a number toward its target (~250ms) so changes read as cause and effect.
export function useCountUp(target: number, ms = 250): number {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reduced) {
      from.current = target;
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const v = origin + (target - origin) * (1 - Math.pow(1 - t, 3));
      from.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduced]);
  return Math.round(reduced ? target : value);
}
