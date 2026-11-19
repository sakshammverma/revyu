import { Icon } from "@/components/hub/Icons";
import { Button } from "@/components/ui";

/**
 * The owner's real QR code on a counter standee, drawn in CSS 3D (no WebGL, so
 * it costs nothing on a budget phone). It turns to face you on hover. Beside
 * it: the three things owners come back to this code for.
 */
export function QrStandeeCard({ outletId, slug, businessName }: { outletId: string; slug: string; businessName: string }) {
  const qrUrl = `/api/app/outlets/${outletId}/qr?format=png`;
  return (
    <section className="v2-sheet border border-line overflow-hidden flex flex-col">
      <div className="group relative flex-1 flex items-center justify-center px-6 pt-6 pb-4 bg-gradient-to-b from-accent-50 to-sheet [perspective:900px]">
        <div className="relative [transform:rotateX(10deg)_rotateY(-24deg)] group-hover:[transform:rotateX(3deg)_rotateY(-6deg)] transition-transform duration-500 ease-out motion-reduce:transition-none">
          <div className="relative w-32 rounded-2xl bg-sheet border border-line p-2.5 flex flex-col items-center gap-2 shadow-[10px_14px_28px_-12px_rgba(22,26,30,0.35),5px_0_0_-1px_var(--color-line-strong)]">
            <p className="max-w-full truncate text-[10px] font-bold uppercase tracking-wider text-text-2">{businessName}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt={`QR code for ${businessName}`} width={104} height={104} className="w-[104px] h-[104px]" />
            <span aria-hidden className="h-1.5 w-10 rounded-full bg-accent" />
          </div>
        </div>
        <div aria-hidden className="absolute bottom-3 left-1/2 -translate-x-1/2 h-3 w-32 rounded-[50%] bg-ink/20 blur-md" />
      </div>

      <div className="p-4 sm:p-5 border-t border-line flex flex-col gap-2">
        <h2 className="font-display text-xl text-ink">Your QR code</h2>
        <p className="text-sm text-text-2 -mt-1">More places to scan means more reviews.</p>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <a
            href={qrUrl}
            download="revyu-qr.png"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-3 rounded-[var(--r-control)] bg-accent text-white text-sm font-semibold hover:bg-accent-hover shadow-v2-btn"
          >
            <Icon name="download" className="w-4 h-4" />
            Download
          </a>
          <Button href="/app/qr" variant="secondary">
            Print files
          </Button>
        </div>
        <a
          href={`/r/${slug}?preview=1`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center min-h-[40px] -mb-1 text-sm font-semibold text-accent-hover hover:underline underline-offset-2"
        >
          See what customers see<span aria-hidden>&nbsp;↗</span>
        </a>
      </div>
    </section>
  );
}
