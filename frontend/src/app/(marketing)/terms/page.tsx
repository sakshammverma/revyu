import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — Revyu",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms govern use of Revyu by business owners (&ldquo;you&rdquo;).
        This page is not final legal copy and should be reviewed by counsel
        before relying on it.
      </p>

      <h2>The service</h2>
      <p>
        Revyu provides a QR code and a mobile web flow that helps your
        customers write and post their own Google reviews. You are
        responsible for placing the QR code where your customers can find
        it, and for the accuracy of the business details you provide at
        signup.
      </p>

      <h2>What we don&rsquo;t guarantee</h2>
      <ul>
        <li>A specific number of reviews.</li>
        <li>An improvement in your star rating.</li>
        <li>An improvement in your search ranking.</li>
        <li>That any given review is actually published — Google&rsquo;s review form is outside our control.</li>
      </ul>

      <h2>Compliant use only</h2>
      <p>
        You may not use Revyu to offer rewards, discounts, or any other
        incentive in exchange for a review, at any rating. You may not
        attempt to selectively show the Google review option only to
        satisfied customers. Both are prohibited under Google&rsquo;s
        policies and under these terms, and we may suspend an account found
        doing either.
      </p>

      <h2>Trial and billing</h2>
      <p>
        New accounts get 15 free days, followed by 10 additional completed
        reviews before your QR pauses. Paid plans are billed monthly or
        annually as selected at signup. See our{" "}
        <a href="/refund-policy" className="text-[#2f68db] underline underline-offset-2 hover:text-[#1a1e23]">
          refund policy
        </a>{" "}
        for cancellation and refund terms.
      </p>

      <h2>Suspension and cancellation</h2>
      <p>
        If payment fails, you get a 7-day grace period with the flow fully
        live before your QR pauses collection. You can cancel at any time;
        your QR keeps working for anyone who scans it, but it stops
        collecting reviews once your subscription ends.
      </p>
    </LegalPage>
  );
}
