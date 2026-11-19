import type { Metadata } from "next";
import Link from "next/link";

import { SignupStatus } from "@/components/marketing/SignupStatus";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: "Your signup — Revyu",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ signupId: string }>;
  searchParams: Promise<{ paid?: string }>;
}

// Same focused frame as the signup wizard: the next step is on screen at once, with no marketing hero above it.
export default async function SignupStatusPage({ params, searchParams }: Props) {
  const { signupId } = await params;
  const { paid } = await searchParams;

  return (
    <div className="marketing-root min-h-[100dvh] flex flex-col bg-bg text-ink">
      <header className="bg-sheet border-b border-line">
        <div className="max-w-5xl mx-auto h-14 sm:h-16 px-4 sm:px-6 flex items-center justify-between gap-3">
          <Link href="/" aria-label="Revyu home" className="text-ink">
            <Logo className="text-lg sm:text-xl" markClassName="w-6 h-6" />
          </Link>
          <Link href="/contact" className="text-sm font-semibold text-text-2 hover:text-ink">
            Need help?
          </Link>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 px-4 sm:px-6 py-6 sm:py-12 outline-none">
        <h1 className="font-display text-2xl sm:text-[2rem] leading-tight text-center text-ink mb-5 sm:mb-8">
          {paid ? "Thank you. You’re almost live." : "Your Revyu signup"}
        </h1>
        <SignupStatus signupId={signupId} justPaid={paid === "1"} />
      </main>
    </div>
  );
}
