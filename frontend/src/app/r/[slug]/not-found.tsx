import Link from "next/link";

// SRS-1.4: a mistyped or retired code lands on a branded page, never a bare 404.
export default function FlowNotFound() {
  return (
    <div className="min-h-screen bg-bg flex items-start sm:items-center justify-center px-3 pt-8">
      <div className="v2-sheet border border-line w-full max-w-md p-8 text-center">
        <p className="font-bold text-lg tracking-tight text-ink">Revyu</p>
        <h1 className="font-display text-2xl text-ink mt-4">We couldn&rsquo;t find that page</h1>
        <p className="text-sm text-text-2 mt-2">
          This QR code may have been mistyped or is no longer in use. Please ask the business for their current code.
        </p>
        <Link href="/" className="btn-primary mt-5 min-h-[48px] w-full">
          Visit Revyu
        </Link>
      </div>
    </div>
  );
}
