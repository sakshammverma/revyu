import type { ReactNode } from "react";

/** The dark title band at the top of an inner marketing page. Sits under the light header. */
export function PageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lead: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mx-2 mt-3 sm:mx-3">
      <section className="night-surface night-grid mx-auto max-w-[1296px] overflow-hidden rounded-2xl px-6 py-12 text-center sm:px-12 sm:py-16 lg:py-20">
        <p className="animate-hero-pop glass-dark inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent-soft" />
          {eyebrow}
        </p>
        <h1 className="heading-h1 animate-hero-pop mx-auto mt-5 max-w-4xl text-white!" style={{ animationDelay: "80ms" }}>
          {title}
        </h1>
        <p className="animate-hero-pop mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg" style={{ animationDelay: "160ms" }}>
          {lead}
        </p>
        {children && (
          <div className="animate-hero-pop mt-7 flex flex-col items-center gap-3" style={{ animationDelay: "240ms" }}>
            {children}
          </div>
        )}
      </section>
    </div>
  );
}
