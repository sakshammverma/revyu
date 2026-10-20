"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: number | null;
  onChange: (rating: number) => void;
}

// How long the tapped stars stay filled before the next screen. The same for every
// rating, and the Google option is on screen the whole time (CR-3), so this is
// feedback for the tap, not a delay in front of anything.
const PICK_MS = 160;

// FR-3, FR-17: 1-5 stars, >=44px touch targets, usable one-handed with clean tactile feedback.
// Plain buttons in a group: picking a star moves on immediately, so it is an action, not a radio.
export function StarRating({ value, onChange }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function pick(star: number) {
    if (picked !== null) return;
    navigator.vibrate?.(10);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      onChange(star);
      return;
    }
    setPicked(star);
    timer.current = setTimeout(() => onChange(star), PICK_MS);
  }

  const activeRating = picked ?? hovered ?? value ?? 0;

  return (
    <div className="flex justify-between items-center gap-1 py-1" role="group" aria-label="Rate your visit">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= activeRating;
        return (
          <button
            key={star}
            type="button"
            aria-label={`Rate ${star} out of 5 stars`}
            onClick={() => pick(star)}
            // Mouse only: on touch screens a hover state would stick after the tap.
            onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(star)}
            onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(null)}
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl hover:bg-white transition-colors duration-150 active:scale-90 cursor-pointer [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className={`h-9 w-9 transition-transform duration-150 ${
                filled ? "text-[#f5a524] scale-110 drop-shadow-[0_2px_4px_rgba(217,119,6,0.25)]" : "text-[#7f898b]"
              }`}
              fill={filled ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinejoin="round"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
