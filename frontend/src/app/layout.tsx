import type { Metadata, Viewport } from "next";
import { Lora, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const siteUrl = process.env.FRONTEND_BASE_URL || "http://localhost:3000";
const description =
  "For any local shop or business. Customers scan, tap what stood out, edit a draft and paste it on Google. Google link at every rating. Flat monthly price, 15-day free trial.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // Pages set full titles ("Pricing — Revyu"), so there is no template.
  title: "Revyu — A printed QR that helps customers write their own Google reviews",
  description,
  applicationName: "Revyu",
  openGraph: {
    type: "website",
    siteName: "Revyu",
    locale: "en_IN",
    title: "Revyu — More honest Google reviews from a printed QR",
    description,
  },
  twitter: { card: "summary", title: "Revyu", description },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#f2f7f7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${lora.variable} ${plusJakartaSans.variable} h-full scroll-smooth`}
    >
      <body className="min-h-full flex flex-col bg-bg text-ink font-sans antialiased selection:bg-accent/15 selection:text-ink">
        {children}
      </body>
    </html>
  );
}
