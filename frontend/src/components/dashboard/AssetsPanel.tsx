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
    <div className="v2-sheet border border-line p-4 sm:p-6">
      <div className="pb-4 border-b border-line">
        <h2 className="font-display text-xl text-ink">Your QR &amp; print files</h2>
        <p className="text-sm text-text-2 mt-0.5">
          Print these anywhere. Wording is always &ldquo;Scan to share your experience&rdquo;.
        </p>
      </div>

      {!ready ? (
        <p className="mt-4 text-sm text-text-2">
          Your files will appear here as soon as we&rsquo;ve verified your business.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <a href={`${base}/qr?format=png`} download="revyu-qr.png" className="btn-primary min-h-[40px]">
              QR code (PNG)
            </a>
            <a href={`${base}/qr?format=svg`} download="revyu-qr.svg" className="btn-pill-light min-h-[40px] border border-line">
              QR code (SVG)
            </a>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRINT_ASSETS.map((a) => (
              <li key={a.key}>
                <a
                  href={`${base}/print-assets/${a.key}`}
                  className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border border-line bg-white hover:border-accent/40 hover:bg-[#f7fafa] transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{a.label}</span>
                    <span className="block text-xs text-text-2">{a.note}</span>
                  </span>
                  <span className="text-xs font-semibold text-accent shrink-0">PDF ↓</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
