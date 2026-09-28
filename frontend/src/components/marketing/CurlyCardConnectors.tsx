"use client";

export function CurlyCardConnectors() {
  return (
    <div className="relative w-full max-w-[1296px] mx-auto px-4 sm:px-8 -mt-2 sm:-mt-4 -mb-8 sm:-mb-10 pointer-events-none z-0 overflow-visible">
      {/* Refined, compact SVG canvas for organic curly connecting lines */}
      <svg
        className="w-full h-16 sm:h-24 overflow-visible"
        viewBox="0 0 1200 120"
        fill="none"
        preserveAspectRatio="none"
      >
        <defs>
          {/* Subtle elegant gradients */}
          <linearGradient id="streamLeftCompact" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#397dff" stopOpacity="0.7" />
            <stop offset="60%" stopColor="#60a5fa" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#397dff" stopOpacity="0.8" />
          </linearGradient>

          <linearGradient id="streamCenterCompact" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.75" />
            <stop offset="60%" stopColor="#397dff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.8" />
          </linearGradient>

          <linearGradient id="streamRightCompact" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.7" />
            <stop offset="60%" stopColor="#34d399" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#397dff" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* =================================================================== */}
        {/* STREAM 1: CURLY / ORGANIC LINE FROM CARD 01 (LEFT: X=200) */}
        {/* =================================================================== */}
        <circle cx="200" cy="4" r="3.5" fill="#397dff" />
        <circle cx="200" cy="4" r="6" fill="#397dff" opacity="0.2" className="animate-ping" />

        {/* Primary Curly Spline from Card 1 to Center Engine (600, 116) */}
        <path
          d="M 200 4 C 160 25, 250 40, 220 65 C 190 90, 320 75, 410 85 C 490 95, 540 105, 600 116"
          stroke="url(#streamLeftCompact)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray="5 3"
          className="animate-[drawPath_4s_linear_infinite]"
        />

        {/* Subtle accent ripple */}
        <path
          d="M 215 4 C 260 20, 180 45, 260 70 C 340 95, 430 80, 500 100 C 550 110, 580 112, 597 116"
          stroke="#397dff"
          strokeWidth="0.8"
          strokeOpacity="0.3"
          strokeLinecap="round"
          strokeDasharray="3 3"
        />

        {/* Traveling Light Pulse along Card 1 path */}
        <circle r="2.8" fill="#397dff">
          <animateMotion
            dur="4s"
            repeatCount="indefinite"
            path="M 200 4 C 160 25, 250 40, 220 65 C 190 90, 320 75, 410 85 C 490 95, 540 105, 600 116"
          />
        </circle>

        {/* =================================================================== */}
        {/* STREAM 2: PLAYFUL CURLY S-CURVE FROM CARD 02 (CENTER: X=600) */}
        {/* =================================================================== */}
        <circle cx="600" cy="4" r="3.5" fill="#f59e0b" />
        <circle cx="600" cy="4" r="6" fill="#f59e0b" opacity="0.2" className="animate-ping" />

        {/* Primary Curly Line from Card 2 straight down */}
        <path
          d="M 600 4 C 560 25, 640 45, 575 70 C 520 90, 630 95, 600 116"
          stroke="url(#streamCenterCompact)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="4 2.5"
          className="animate-[drawPath_3s_linear_infinite]"
        />

        {/* Traveling Light Pulse along Card 2 path */}
        <circle r="2.8" fill="#f59e0b">
          <animateMotion
            dur="3s"
            repeatCount="indefinite"
            path="M 600 4 C 560 25, 640 45, 575 70 C 520 90, 630 95, 600 116"
          />
        </circle>

        {/* =================================================================== */}
        {/* STREAM 3: CURLY / ORGANIC LINE FROM CARD 03 (RIGHT: X=1000) */}
        {/* =================================================================== */}
        <circle cx="1000" cy="4" r="3.5" fill="#16a34a" />
        <circle cx="1000" cy="4" r="6" fill="#16a34a" opacity="0.2" className="animate-ping" />

        {/* Primary Curly Spline from Card 3 to Center Engine (600, 116) */}
        <path
          d="M 1000 4 C 1040 25, 950 40, 980 65 C 1010 90, 880 75, 790 85 C 710 95, 660 105, 600 116"
          stroke="url(#streamRightCompact)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray="5 3"
          className="animate-[drawPath_4s_linear_infinite]"
        />

        {/* Subtle accent ripple */}
        <path
          d="M 985 4 C 940 20, 1020 45, 940 70 C 860 95, 770 80, 700 100 C 650 110, 620 112, 603 116"
          stroke="#16a34a"
          strokeWidth="0.8"
          strokeOpacity="0.3"
          strokeLinecap="round"
          strokeDasharray="3 3"
        />

        {/* Traveling Light Pulse along Card 3 path */}
        <circle r="2.8" fill="#16a34a">
          <animateMotion
            dur="4s"
            repeatCount="indefinite"
            path="M 1000 4 C 1040 25, 950 40, 980 65 C 1010 90, 880 75, 790 85 C 710 95, 660 105, 600 116"
          />
        </circle>

        {/* Central Influx Node where streams meet */}
        <circle cx="600" cy="116" r="4.5" fill="#397dff" opacity="0.3" className="animate-ping" />
        <circle cx="600" cy="116" r="2.5" fill="#1a1e23" />
      </svg>
    </div>
  );
}
