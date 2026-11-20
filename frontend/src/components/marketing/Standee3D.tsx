"use client";

import { useRef, type PointerEvent } from "react";

/**
 * A counter standee in CSS 3D, carrying a real, scannable code. It turns a few
 * degrees toward the pointer and a band of light moves across the acrylic; left
 * alone it floats gently. No WebGL: the whole thing is a handful of transformed
 * boxes, so it costs nothing to load and prints nothing to the GPU when idle.
 *
 * `flat` (the sales deck, where someone scans it off a screen): face-on, still, no glare
 * over the modules, and the full 4-module quiet zone, so a phone camera reads it first time.
 */
export function Standee3D({
  qrPath,
  qrSize,
  label,
  name,
  headline = "Loved it? Tell us.",
  cta = "Scan with your camera",
  flat = false,
}: {
  qrPath: string;
  qrSize: number;
  label: string;
  /** The shop's name above the code, as on the printed standee (the sales demo). */
  name?: string;
  headline?: string;
  cta?: string;
  flat?: boolean;
}) {
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

  const quiet = flat ? 4 : 2;
  return (
    <div
      ref={stage}
      onPointerMove={flat ? undefined : onMove}
      onPointerLeave={flat ? undefined : onLeave}
      className="standee-stage"
      // Flat: the stage grows with the sheet (the bigger code no longer fits the fixed 320px
      // box, and an absolutely placed sheet would spill up over the text above it).
      style={flat ? { height: "auto" } : undefined}
    >
      <div className="standee-float" style={flat ? { animation: "none", position: "relative" } : undefined}>
        <div className="standee" style={flat ? { transform: "none" } : undefined}>
          {/* Acrylic sheet */}
          <div className="standee-sheet">
            {name && <p className="font-display text-[17px] leading-tight text-ink line-clamp-2 mb-1">{name}</p>}
            <p className={name ? "text-[12px] font-semibold leading-tight text-text-2" : "font-display text-[19px] leading-tight text-ink"}>{headline}</p>
            <svg
              role="img"
              aria-label={label}
              viewBox={`${-quiet} ${-quiet} ${qrSize + quiet * 2} ${qrSize + quiet * 2}`}
              className={`mt-2.5 text-ink ${flat ? "h-[164px] w-[164px]" : "h-[148px] w-[148px]"}`}
              shapeRendering="crispEdges"
            >
              <path d={qrPath} fill="currentColor" />
            </svg>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-2">{cta}</p>
            {!flat && <span aria-hidden className="standee-glare" />}
          </div>
          {/* Its edge, and the block it slots into */}
          <span aria-hidden className="standee-edge" />
          <span aria-hidden className="standee-base" />
          <span aria-hidden className="standee-base-top" />
        </div>
      </div>
      <span aria-hidden className="standee-shadow" style={flat ? { animation: "none" } : undefined} />
    </div>
  );
}
