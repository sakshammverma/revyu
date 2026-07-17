import type { Overview as OverviewData } from "@/lib/dashboard/api";

export function Overview({ data }: { data: OverviewData }) {
  return (
    <div className="v2-sheet border border-[#e8ecec] p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#e8ecec] gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#397dff] shrink-0" />
            <h1 className="font-display text-2xl sm:text-3xl leading-tight text-[#1a1e23] truncate">{data.business_name}</h1>
          </div>
          <p className="text-sm text-[#515a63] mt-1">Outlet Performance Overview</p>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#f0f7ed] border border-[#449127]/25 text-[#2f6b1a] text-xs font-semibold self-start sm:self-auto">
          <span className="w-1.5 h-1.5 rounded-full bg-[#449127] animate-pulse" />
          Live
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4 sm:mt-5">
        <Stat label="Total Scans" value={data.scans} note="QR opened" />
        <Stat label="Completed Flows" value={data.completed_flows} note="Copied their draft" />
        <Stat
          label="Conversion Rate"
          value={`${(data.conversion_rate * 100).toFixed(1)}%`}
          note="Scan to complete"
          highlight
        />
      </div>

      {data.dashboard_locked && (
        <div className="mt-4 sm:mt-5 p-3.5 sm:p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm leading-relaxed flex items-start gap-2">
          <span>🔒</span>
          <span>Dashboard locked — trial threshold reached. Your QR keeps collecting uninterrupted.</span>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  highlight = false,
}: {
  label: string;
  value: string | number;
  note?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-3 sm:p-5 rounded-xl border min-w-0 ${
        highlight ? "bg-[#f5f9ff] border-[#397dff]/25" : "bg-[#f7fafa] border-[#e8ecec]"
      }`}
    >
      <p className="text-[11px] sm:text-xs sm:uppercase sm:tracking-wider text-[#515a63] font-semibold leading-tight break-words">{label}</p>
      <p className="font-display text-2xl sm:text-4xl leading-none tabular-nums mt-2 text-[#1a1e23]">
        {value}
      </p>
      {note && <p className="text-[11px] sm:text-xs text-[#515a63] mt-1.5 leading-snug">{note}</p>}
    </div>
  );
}
