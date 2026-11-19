"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";

import { useInView } from "./interact";

/**
 * Fades its children up the first time they scroll into view. `order` staggers
 * siblings. Without JavaScript the content is simply shown (see the noscript
 * rule in MarketingPage); under reduced motion it appears without movement.
 * Not for content above the fold: use the load-in keyframes there.
 */
export function Reveal({
  children,
  order = 0,
  className = "",
}: {
  children: ReactNode;
  order?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { threshold: 0.12 });
  return (
    <div ref={ref} data-on={inView} style={{ "--rv-i": order } as CSSProperties} className={`rv ${className}`}>
      {children}
    </div>
  );
}
