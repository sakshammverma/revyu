import React from "react";

// Eyebrow pill, matching the inner-page pattern (compliance / pricing):
// white pill, 1px line border, soft rest shadow, small accent dot.
export function MonoLabel({
  index,
  children,
  tone = "brand",
}: {
  index?: string;
  children: React.ReactNode;
  tone?: "brand" | "muted";
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide border before:block before:w-1.5 before:h-1.5 before:rounded-full before:shrink-0 ${
        tone === "brand"
          ? "bg-[#e7f5fd] text-[#2f68db] border-[#397dff]/20 before:bg-[#2f68db]"
          : "bg-white text-[#515a63] border-[#e8ecec] shadow-v2-rest before:bg-[#397dff]"
      }`}
    >
      {index && (
        <span className="font-mono text-[11px] font-bold opacity-75">
          {index}
        </span>
      )}
      <span>{children}</span>
    </div>
  );
}
