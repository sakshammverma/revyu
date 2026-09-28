import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Revyu",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        Revyu collects the minimum data needed to run the product. This page
        describes what we hold today; it is not final legal copy and should
        be reviewed by counsel before relying on it.
      </p>

      <h2>What we collect about business owners</h2>
      <p>
        Name, phone number (account identity), email address (login and OTP
        delivery), business details, and billing information processed by our
        payment provider.
      </p>

      <h2>What we collect about customers who scan the QR</h2>
      <p>
        Nothing that identifies you, by default. Customers never create an
        account and are never asked to log in. We record an anonymous session
        ID, your star rating, the tags you select, and analytics events used
        to measure where people drop off in the flow.
      </p>
      <p>
        If you voluntarily submit private feedback, the message and any
        contact details you choose to include are stored so the business
        owner can respond. This is the only place customer-identifying
        information can enter the system, and it is optional.
      </p>

      <h2>What we never do</h2>
      <ul>
        <li>We never store pre-written review text of any kind.</li>
        <li>We never verify whether a review was actually published on Google.</li>
        <li>We never share customer data with third parties for marketing.</li>
        <li>We never track a customer across different businesses.</li>
      </ul>

      <h2>Retention</h2>
      <p>
        Analytics events are retained for 24 months. Private feedback is
        retained until the business owner or the customer requests deletion.
      </p>

      <h2>Your rights</h2>
      <p>
        You may request access to or deletion of any personal data we hold
        about you by contacting us. If you submitted private feedback and
        want it removed, tell us the business name and approximate date and
        we will locate and delete it.
      </p>
    </LegalPage>
  );
}
