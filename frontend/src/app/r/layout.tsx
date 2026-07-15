// Customer flow layout (/r/{slug}). Deliberately adds nothing: the flow uses
// the root layout's design-system faces (Plus Jakarta Sans for text, Lora for
// the display headings), which are already loaded. The previous Archivo and
// Geist Mono faces were declared here but referenced by no class, so they only
// cost preload bytes on the surface with the tightest budget (< 150KB, NFR-2).
export default function FlowLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
