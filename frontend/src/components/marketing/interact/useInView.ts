"use client";

import { useEffect, useState, type RefObject } from "react";

export function useInView<T extends Element>(
  ref: RefObject<T | null>,
  { threshold = 0.45, once = true }: { threshold?: number; once?: boolean } = {},
): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        setInView(e.isIntersecting);
        if (e.isIntersecting && once) io.disconnect();
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold, once]);
  return inView;
}
