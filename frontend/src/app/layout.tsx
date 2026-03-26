import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Revyu — A printed QR that helps customers write their own Google reviews",
  description: "For any local shop or business. Customers scan, tap what stood out, edit a draft and paste it on Google. Google link at every rating. ₹499/month, 15-day free trial.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${lora.variable} ${plusJakartaSans.variable} h-full scroll-smooth`}
    >
      <body className="min-h-full flex flex-col bg-[#f2f7f7] text-[#1a1e23] font-sans antialiased selection:bg-[#397dff]/15 selection:text-[#1a1e23]">
        {children}
      </body>
    </html>
  );
}
