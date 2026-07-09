import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

// Contrast (CR-3.8, WCAG AA): every variant keeps label text >= 4.5:1.
// primary  — white on #2f68db  ≈ 5.1:1 (the lighter #397dff is only ~3.8:1)
// secondary— white on #1f2429  ≈ 15:1
// outline  — #1a1e23 on white  ≈ 16:1, with a visible #bfc8ca border; never greyed
const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-[#2f68db] hover:bg-[#2757b8] text-white border border-transparent shadow-v2-btn",
  secondary:
    "bg-[#1f2429] hover:bg-[#2b3239] text-white border border-transparent shadow-v2-rest",
  outline:
    "bg-white hover:bg-[#f7fafa] text-[#1a1e23] border border-[#bfc8ca] hover:border-[#1a1e23] shadow-v2-rest",
};

export function FlowButton({ variant = "primary", className = "", ...rest }: Props) {
  return (
    <button
      className={`w-full min-h-[48px] px-5 py-3 rounded-xl font-semibold text-base leading-snug tracking-tight transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#397dff] focus-visible:ring-offset-2 ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    />
  );
}
