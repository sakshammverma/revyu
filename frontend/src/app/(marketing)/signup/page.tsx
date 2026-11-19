import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { SignupForm } from "@/components/marketing/SignupForm";

export const metadata: Metadata = pageMetadata({
  path: "/signup",
  title: "Start your free trial — Revyu",
  description:
    "Set up your Google review collection QR in 3 minutes. 15-day free trial. Secure payment set-up, first charge after your trial.",
});

// A focused, full-screen flow: no marketing header, hero or footer competing with the form.
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { email, ref, place, name, plan } = await searchParams;
  const initialEmail = typeof email === "string" ? email : "";
  // The pricing page links here with the plan the visitor clicked.
  const initialPlan = plan === "annual" ? "annual" : "monthly";
  const referralCode = typeof ref === "string" ? ref.slice(0, 16) : "";
  // From the gap report: the place is already known, so preselect it.
  const initialPlace =
    typeof place === "string" && /^[A-Za-z0-9_-]{3,300}$/.test(place) && typeof name === "string" && name.trim()
      ? { place_id: place, name: name.trim().slice(0, 120) }
      : undefined;

  return <SignupForm initialEmail={initialEmail} referralCode={referralCode} initialPlace={initialPlace} initialPlan={initialPlan} />;
}
