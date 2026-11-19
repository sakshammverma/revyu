"use client";

import { useRef, type PointerEvent } from "react";

/**
 * A counter standee in CSS 3D, carrying a real, scannable code. It turns a few
 * degrees toward the pointer and a band of light moves across the acrylic; left
 * alone it floats gently. No WebGL: the whole thing is a handful of transformed
 * boxes, so it costs nothing to load and prints nothing to the GPU when idle.
 */
export function Standee3D({ qrPath, qrSize, label }: { qrPath: string; qrSize: number; label: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    const el = stage.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--ry", `${(x * 26).toFixed(2)}deg`);
      el.style.setProperty("--rx", `${(-y * 16).toFixed(2)}deg`);
      el.style.setProperty("--gx", `${(50 + x * 90).toFixed(1)}%`);
    });
  }

  function onLeave() {
    const el = stage.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.removeProperty("--ry");
    el.style.removeProperty("--rx");
    el.style.removeProperty("--gx");
  }

  const quiet = 2;
  return (
    <div ref={stage} onPointerMove={onMove} onPointerLeave={onLeave} className="standee-stage">
      <div className="standee-float">
        <div className="standee">
          {/* Acrylic sheet */}
          <div className="standee-sheet">
            <p className="font-display text-[19px] leading-tight text-ink">Loved it? Tell us.</p>
            <svg
              role="img"
              aria-label={label}
              viewBox={`${-quiet} ${-quiet} ${qrSize + quiet * 2} ${qrSize + quiet * 2}`}
              className="mt-2.5 h-[148px] w-[148px] text-ink"
              shapeRendering="crispEdges"
            >
              <path d={qrPath} fill="currentColor" />
            </svg>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-2">Scan with your camera</p>
            <span aria-hidden className="standee-glare" />
          </div>
          {/* Its edge, and the block it slots into */}
          <span aria-hidden className="standee-edge" />
          <span aria-hidden className="standee-base" />
          <span aria-hidden className="standee-base-top" />
        </div>
      </div>
      <span aria-hidden className="standee-shadow" />
    </div>
  );
}
