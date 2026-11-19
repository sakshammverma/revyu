"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { TrendDay } from "@/lib/dashboard/api";

/** The two series, in a fixed order. Colours are tokens (globals.css), validated as a colour-blind-safe pair. */
export const TREND_SERIES = [
  { key: "scans", label: "QR scans", color: "var(--accent)" },
  { key: "completed", label: "Drafts copied", color: "var(--chart-2)" },
] as const;

const PAD = { left: 34, right: 14, top: 14, bottom: 26 };

const utcDay = (date: string) => new Date(`${date}T00:00:00Z`);
const fmt = (date: string, opts: Intl.DateTimeFormatOptions) =>
  utcDay(date).toLocaleDateString("en-IN", { timeZone: "UTC", ...opts });
const shortDate = (date: string) => fmt(date, { day: "numeric", month: "short" });
const longDate = (date: string) => fmt(date, { weekday: "short", day: "numeric", month: "short" });

/** A y-axis that ends on a round number, with at most five whole-number ticks. */
function niceScale(dataMax: number) {
  const target = Math.max(dataMax, 4);
  const raw = target / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const max = Math.ceil(target / step) * step;
  return { max, ticks: Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step) };
}

/** Smooth line through the points that never overshoots them (monotone cubic, Fritsch-Carlson). */
function monotonePath(pts: [number, number][]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    slope.push((pts[i + 1][1] - pts[i][1]) / dx[i]);
  }
  const t = [slope[0]];
  for (let i = 1; i < n - 1; i++) t.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  t.push(slope[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / slope[i];
    const b = t[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      t[i] = tau * a * slope[i];
      t[i + 1] = tau * b * slope[i];
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

/**
 * Daily scans and drafts copied on one shared axis. Pointer, touch and arrow
 * keys all move the same crosshair; every value is also in a table for screen
 * readers, so the tooltip never holds anything the page doesn't.
 */
export function TrendChart({ days, height = 220 }: { days: TrendDay[]; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = days.length;
  const geo = useMemo(() => {
    const innerW = Math.max(width - PAD.left - PAD.right, 1);
    const innerH = height - PAD.top - PAD.bottom;
    const scale = niceScale(Math.max(0, ...days.map((d) => Math.max(d.scans, d.completed))));
    const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - (v / scale.max) * innerH;
    const line = (key: "scans" | "completed") => monotonePath(days.map((d, i) => [x(i), y(d[key])]));
    const scans = line("scans");
    return {
      innerW,
      scale,
      x,
      y,
      scans,
      completed: line("completed"),
      area: n > 1 ? `${scans}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z` : "",
    };
  }, [days, width, height, n]);

  // A label on every day for a week; weekly labels counted back from today for a month.
  const xTicks = useMemo(
    () => days.map((_, i) => i).filter((i) => n <= 8 || (n - 1 - i) % 7 === 0),
    [days, n],
  );
  const empty = days.every((d) => d.scans === 0 && d.completed === 0);
  const current = active !== null && active < n ? days[active] : null;

  function pick(clientX: number) {
    const box = wrap.current?.getBoundingClientRect();
    if (!box || n === 0) return;
    const ratio = (clientX - box.left - PAD.left) / geo.innerW;
    setActive(Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1)))));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const step = e.key === "ArrowRight" ? 1 : -1;
      setActive((i) => Math.min(n - 1, Math.max(0, (i ?? (step > 0 ? -1 : n)) + step)));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(n - 1);
    } else if (e.key === "Escape") {
      setActive(null);
    }
  }

  const cx = current && active !== null ? geo.x(active) : 0;
  const tipOnLeft = cx > width / 2;

  return (
    <div>
      <div
        ref={wrap}
        role="group"
        tabIndex={0}
        aria-label="Daily QR scans and drafts copied. Use the left and right arrow keys to read each day."
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        className="relative select-none rounded-lg touch-pan-y"
        style={{ height }}
      >
        {width > 0 && (
          <svg
            width={width}
            height={height}
            aria-hidden
            className="block"
            onPointerMove={(e) => pick(e.clientX)}
            onPointerDown={(e) => pick(e.clientX)}
            onPointerLeave={() => setActive(null)}
          >
            <defs>
              <linearGradient id="trend-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {geo.scale.ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={geo.y(tick)}
                  y2={geo.y(tick)}
                  stroke={tick === 0 ? "var(--color-line-strong)" : "var(--line)"}
                  strokeWidth="1"
                  shapeRendering="crispEdges"
                />
                <text x={PAD.left - 8} y={geo.y(tick)} dy="0.32em" textAnchor="end" className="fill-text-muted text-[11px] tabular-nums">
                  {tick}
                </text>
              </g>
            ))}

            {xTicks.map((i) => (
              <text
                key={days[i].date}
                x={geo.x(i)}
                y={height - 6}
                textAnchor={i === n - 1 ? "end" : "middle"}
                className="fill-text-muted text-[11px]"
              >
                {n <= 8 ? fmt(days[i].date, { weekday: "short" }) : shortDate(days[i].date)}
              </text>
            ))}

            {geo.area && <path d={geo.area} fill="url(#trend-area)" />}
            <path d={geo.completed} fill="none" stroke="var(--chart-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d={geo.scans} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

            {/* Today: the one point marked without hovering. */}
            {!current && n > 0 && !empty && (
              <circle cx={geo.x(n - 1)} cy={geo.y(days[n - 1].scans)} r="4" fill="var(--accent)" stroke="var(--sheet)" strokeWidth="2" />
            )}

            {current && (
              <g>
                <line x1={cx} x2={cx} y1={PAD.top} y2={geo.y(0)} stroke="var(--color-line-strong)" strokeWidth="1" />
                {TREND_SERIES.map((s) => (
                  <circle key={s.key} cx={cx} cy={geo.y(current[s.key])} r="4.5" fill={s.color} stroke="var(--sheet)" strokeWidth="2" />
                ))}
              </g>
            )}
          </svg>
        )}

        {empty && width > 0 && (
          <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-text-2 pointer-events-none">
            No scans in this period yet.
          </p>
        )}

        {current && (
          <div
            className="absolute top-2 z-10 pointer-events-none rounded-xl bg-sheet border border-line shadow-v2-elevated px-3 py-2 min-w-[150px]"
            style={tipOnLeft ? { right: width - cx + 12 } : { left: cx + 12 }}
          >
            <p className="text-xs text-text-2">{longDate(current.date)}</p>
            {TREND_SERIES.map((s) => (
              <p key={s.key} className="mt-1 flex items-center gap-2 text-sm">
                <span aria-hidden className="w-3 h-0.5 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="font-semibold text-ink tabular-nums">{current[s.key]}</span>
                <span className="text-text-2">{s.label}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {current && `${longDate(current.date)}: ${current.scans} QR scans, ${current.completed} drafts copied`}
      </p>
      <table className="sr-only">
        <caption>Daily QR scans and drafts copied</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">QR scans</th>
            <th scope="col">Drafts copied</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{longDate(d.date)}</th>
              <td>{d.scans}</td>
              <td>{d.completed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
