// QR + print files (SRS-10.10). Plain links: same-origin via the /api rewrite,
// so the owner session cookie rides along and the backend streams the file.
// Assets only exist once the outlet is approved (backend returns 404 before).
const PRINT_ASSETS = [
  { key: "receipt-footer", label: "Receipt footer", note: "80 × 60 mm · take-home" },
  { key: "handout-card", label: "Handout card", note: "A7 · take-home" },
  { key: "counter-standee", label: "Counter standee", note: "A5 · counter" },
  { key: "counter-sticker", label: "Counter sticker", note: "100 × 100 mm · counter" },
];

export function AssetsPanel({ outletId, state }: { outletId: string; state: string }) {
  const ready = !state.startsWith("pending");
  const base = `/api/app/outlets/${outletId}`;

  return (
    <div className="v2-sheet border border-[#e8ecec] p-4 sm:p-6">
      <div className="pb-4 border-b border-[#e8ecec]">
        <h2 className="font-display text-xl text-[#1a1e23]">Your QR &amp; print files</h2>
        <p className="text-sm text-[#515a63] mt-0.5">
          Print these anywhere. Wording is always &ldquo;Scan to share your experience&rdquo;.
        </p>
      </div>

      {!ready ? (
        <p className="mt-4 text-sm text-[#515a63]">
          Your files will appear here as soon as we&rsquo;ve verified your business.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <a href={`${base}/qr?format=png`} download className="btn-primary min-h-[40px]">
              QR code (PNG)
            </a>
            <a href={`${base}/qr?format=svg`} download className="btn-pill-light min-h-[40px] border border-[#e8ecec]">
              QR code (SVG)
            </a>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRINT_ASSETS.map((a) => (
              <li key={a.key}>
                <a
                  href={`${base}/print-assets/${a.key}`}
                  className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border border-[#e8ecec] bg-white hover:border-[#397dff]/40 hover:bg-[#f7fafa] transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[#1a1e23]">{a.label}</span>
                    <span className="block text-xs text-[#515a63]">{a.note}</span>
                  </span>
                  <span className="text-xs font-semibold text-[#2f68db] shrink-0">PDF ↓</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
