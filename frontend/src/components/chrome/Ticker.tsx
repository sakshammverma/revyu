import React from "react";

export function Ticker() {
  const items = [
    "100% GOOGLE POLICY COMPLIANT",
    "NO SENTIMENT GATING",
    "REAL-TIME DRAFT ASSEMBLY",
    "DIRECT GOOGLE MAPS HANDOFF",
    "ZERO BLANK-BOX PANIC",
    "FLAT ₹499/MO",
    "VERIFIED OUTLET QR",
    "CUSTOMER REMAINS THE AUTHOR",
    "PRINTED MATERIAL ONLY",
  ];

  return (
    <div className="w-full border-y border-line bg-paper-subtle/80 overflow-hidden py-2.5 font-mono text-[1.15rem] uppercase tracking-wider text-ink-muted select-none">
      <div className="flex w-max animate-ticker gap-8 items-center">
        {[...items, ...items].map((item, idx) => (
          <div key={idx} className="flex items-center gap-4 shrink-0">
            <span className="hover:text-brand transition-colors">{item}</span>
            <span className="text-brand font-bold text-[1rem]">⚙</span>
          </div>
        ))}
      </div>
    </div>
  );
}
