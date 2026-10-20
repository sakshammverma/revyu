import type { ReactNode } from "react";

// Screen is laid out at a real phone size and scaled down, so flow markup keeps
// real proportions instead of hand-shrunk micro text.
const SCREEN_W = 360;
const SCREEN_H = 720;
const BEZEL = 10;

export function PhoneMockup({
  children,
  chrome = "none",
  scale = 0.72,
  dark = false,
}: {
  children: ReactNode;
  /** "browser" adds a Safari-style address bar: the customer flow is just a web page. */
  chrome?: "browser" | "none";
  scale?: number;
  dark?: boolean;
}) {
  const outerW = SCREEN_W + BEZEL * 2;
  const outerH = SCREEN_H + BEZEL * 2;
  const ink = dark ? "text-white" : "text-[#1a1e23]";
  return (
    <div style={{ width: outerW * scale, height: outerH * scale }} className="relative shrink-0">
      <div
        style={{ width: outerW, height: outerH, transform: `scale(${scale})`, transformOrigin: "top left" }}
        className="absolute top-0 left-0"
      >
        {/* side buttons */}
        <span aria-hidden className="absolute -left-[3px] top-[110px] w-[4px] h-[28px] rounded-l bg-[#2b3239]" />
        <span aria-hidden className="absolute -left-[3px] top-[170px] w-[4px] h-[56px] rounded-l bg-[#2b3239]" />
        <span aria-hidden className="absolute -left-[3px] top-[240px] w-[4px] h-[56px] rounded-l bg-[#2b3239]" />
        <span aria-hidden className="absolute -right-[3px] top-[190px] w-[4px] h-[88px] rounded-r bg-[#2b3239]" />

        <div
          className="w-full h-full rounded-[54px] bg-[#0e1113] shadow-v2-phone border border-[#4a545d]"
          style={{ padding: BEZEL, boxShadow: "inset 0 0 0 2px #1f252a, 0 25px 50px -12px rgba(0,0,0,0.45)" }}
        >
          <div className="relative w-full h-full rounded-[44px] overflow-hidden bg-white flex flex-col">
            {/* status bar + dynamic island */}
            <div className={`relative z-20 h-[48px] shrink-0 flex items-end justify-between px-8 pb-1.5 text-[15px] font-semibold ${ink}`}>
              <span>9:41</span>
              <span aria-hidden className="absolute left-1/2 -translate-x-1/2 top-[11px] w-[104px] h-[30px] rounded-full bg-black" />
              <span aria-hidden className="flex items-center gap-1.5">
                <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
                  <rect x="0" y="8" width="3" height="4" rx="1" />
                  <rect x="5" y="5" width="3" height="7" rx="1" />
                  <rect x="10" y="2.5" width="3" height="9.5" rx="1" />
                  <rect x="15" y="0" width="3" height="12" rx="1" />
                </svg>
                <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M1.5 4.2a9.5 9.5 0 0 1 13 0M4 7a6 6 0 0 1 8 0" />
                  <circle cx="8" cy="10" r="1" fill="currentColor" stroke="none" />
                </svg>
                <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
                  <rect x="0.5" y="0.5" width="22" height="12" rx="3.5" stroke="currentColor" opacity="0.4" />
                  <rect x="2" y="2" width="19" height="9" rx="2" fill="currentColor" />
                  <rect x="24" y="4" width="2" height="5" rx="1" fill="currentColor" opacity="0.4" />
                </svg>
              </span>
            </div>

            <div className="relative flex-1 min-h-0 overflow-hidden">{children}</div>

            {chrome === "browser" && (
              <div className="shrink-0 bg-[#f2f2f4] border-t border-[#d9dadd] px-4 pt-2 pb-5">
                <div className="h-9 rounded-xl bg-white border border-[#e1e2e5] flex items-center justify-center gap-1.5 text-[14px] text-[#1a1e23]">
                  <svg width="11" height="13" viewBox="0 0 11 13" fill="currentColor" aria-hidden>
                    <path d="M2 5V3.5a3.5 3.5 0 0 1 7 0V5h.5A1.5 1.5 0 0 1 11 6.5v5A1.5 1.5 0 0 1 9.5 13h-8A1.5 1.5 0 0 1 0 11.5v-5A1.5 1.5 0 0 1 1.5 5H2Zm1.5 0h4V3.5a2 2 0 0 0-4 0V5Z" />
                  </svg>
                  revyu.in
                </div>
              </div>
            )}

            {/* home indicator */}
            <span
              aria-hidden
              className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-[130px] h-[5px] rounded-full z-20 ${dark ? "bg-white/70" : "bg-[#1a1e23]/80"}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
