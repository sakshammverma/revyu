"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { AppShell } from "@/components/portal/AppShell";
import { OwnerProvider } from "@/components/portal/OwnerContext";
import { SignupStatus } from "@/components/marketing/SignupStatus";
import { Button, Skeleton, ToastProvider } from "@/components/ui";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <OwnerProvider
        loading={
          <div className="min-h-screen bg-bg p-6 flex flex-col gap-4 max-w-5xl mx-auto" aria-busy="true" aria-label="Loading dashboard">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        }
        failed={(retry) => (
          <main className="min-h-screen bg-bg flex items-center justify-center p-4">
            <div role="alert" className="v2-sheet border border-line p-8 text-center max-w-md w-full">
              <p className="font-display text-xl text-ink">We couldn&rsquo;t load your dashboard</p>
              <p className="text-sm text-text-2 mt-1">Check your connection and try again. Your QR code keeps working.</p>
              <Button onClick={retry} className="mt-4">
                Try again
              </Button>
            </div>
          </main>
        )}
        preLive={(outlet) => (
          <main className="min-h-screen bg-bg p-4 sm:p-6 flex flex-col items-center justify-center gap-6">
            <Link href="/" className="font-bold text-lg tracking-tight text-ink">
              Revyu
            </Link>
            <div className="w-full">
              <SignupStatus signupId={outlet.outlet_id} />
            </div>
          </main>
        )}
      >
        <AppShell>{children}</AppShell>
      </OwnerProvider>
    </ToastProvider>
  );
}
