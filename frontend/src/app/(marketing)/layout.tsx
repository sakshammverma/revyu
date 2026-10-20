import { PricingProvider } from "@/lib/pricing";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <PricingProvider>{children}</PricingProvider>;
}
