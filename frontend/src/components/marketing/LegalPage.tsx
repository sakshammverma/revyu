import { MarketingPage } from "@/components/chrome/MarketingPage";
import { MonoLabel } from "@/components/chrome/MonoLabel";
import { Section } from "@/components/chrome/Grid";

export function LegalPage({
  title,
  subtitle = "Standard merchant terms & conditions",
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <MarketingPage>
      <Section className="pt-12 sm:pt-20 pb-8 sm:pb-10">
        <div className="max-w-3xl mx-auto text-center">
          <MonoLabel tone="muted">Legal Documentation</MonoLabel>
          <h1 className="heading-h1 font-display mt-4 text-ink tracking-tight">{title}</h1>
          <p className="mt-3 text-sm text-text-2">{subtitle}</p>
        </div>
      </Section>

      <Section className="pb-20">
        <div className="v2-sheet border border-line p-6 sm:p-10 lg:p-12 max-w-3xl mx-auto">
          <div className="flex flex-col gap-4 text-sm sm:text-base text-text-2 leading-relaxed [&_h2]:font-serif [&_h2]:font-normal [&_h2]:text-xl sm:[&_h2]:text-2xl [&_h2]:leading-snug [&_h2]:tracking-tight [&_h2]:text-ink [&_h2]:mt-6 [&_h2]:-mb-1 [&_h2:first-child]:mt-0 [&_p]:leading-relaxed [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5 [&_li]:list-disc [&_li::marker]:text-text-muted [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-ink [&_strong]:text-ink">
            {children}
          </div>
        </div>
      </Section>
    </MarketingPage>
  );
}
