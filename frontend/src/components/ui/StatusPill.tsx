type Tone = "success" | "warning" | "alert" | "info" | "neutral";

const TONES: Record<Tone, string> = {
  success: "bg-success-50 text-[#2f6b1a] border-success/25",
  warning: "bg-warning-50 text-warning border-warning/25",
  alert: "bg-alert-50 text-alert border-alert/25",
  info: "bg-accent-50 text-accent-hover border-accent/25",
  neutral: "bg-paper-subtle text-text-2 border-line-strong",
};

/** One place that maps every outlet state to one label + one colour. */
export const OUTLET_STATE: Record<string, { label: string; tone: Tone }> = {
  trial: { label: "Free trial", tone: "info" },
  active: { label: "Live", tone: "success" },
  locked: { label: "Dashboard locked", tone: "warning" },
  past_due: { label: "Payment failed", tone: "alert" },
  suspended: { label: "Collection paused", tone: "alert" },
  deactivated: { label: "Deactivated", tone: "neutral" },
  pending_payment: { label: "Awaiting payment", tone: "warning" },
  pending_approval: { label: "Being verified", tone: "info" },
  rejected: { label: "Not approved", tone: "alert" },
};

export function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${TONES[tone]}`}>
      <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function OutletStatePill({ state }: { state: string }) {
  const s = OUTLET_STATE[state] ?? { label: state, tone: "neutral" as Tone };
  return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
}
