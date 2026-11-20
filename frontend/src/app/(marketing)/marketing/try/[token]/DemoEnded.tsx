import { FlowFrame } from "@/components/flow/Frame";

/** A forged, mangled or expired try link. Neutral on purpose: no way back into the sales tool. */
export function DemoEnded() {
  return (
    <FlowFrame>
      <div className="v2-sheet border border-line p-6 sm:p-8 flex flex-col gap-2 text-center">
        <h1 className="font-display tracking-tight leading-tight text-ink text-[26px]">This demo has ended</h1>
        <p className="text-sm text-text-2 leading-relaxed">Demo links only work for a few hours, and nothing was recorded.</p>
      </div>
    </FlowFrame>
  );
}
