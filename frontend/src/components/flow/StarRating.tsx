"use client";

import { useState } from "react";

interface Props {
  value: number | null;
  onChange: (rating: number) => void;
}

// FR-3, FR-17: 1-5 stars, >=44px touch targets, usable one-handed with clean tactile feedback
export function StarRating({ value, onChange }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  const activeRating = hovered ?? value ?? 0;

  return (
    <div className="flex justify-between items-center gap-1 py-1" role="radiogroup" aria-label="Rate your visit">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= activeRating;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl hover:bg-white transition-colors duration-150 active:scale-90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#397dff]"
          >
            <svg
              viewBox="0 0 24 24"
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
