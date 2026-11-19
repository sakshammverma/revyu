/**
 * The "start free trial" email field. A plain GET form to /signup, which reads
 * ?email= and prefills it, so it works before (and without) JavaScript.
 */
export function EmailCapture({
  tone = "light",
  cta = "Start free trial",
  className = "",
}: {
  tone?: "light" | "dark";
  cta?: string;
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <form
      action="/signup"
      method="get"
      className={`flex w-full max-w-[460px] items-center gap-1 rounded-xl p-1.5 transition-colors focus-within:border-accent ${
        dark ? "border border-white/20 bg-white/[0.07] focus-within:bg-white/10" : "border border-line bg-white shadow-v2-elevated"
      } ${className}`}
    >
      <input
        type="email"
        name="email"
        autoComplete="email"
        aria-label="Your business email"
        placeholder="Business email"
        className={`min-w-0 flex-1 bg-transparent px-2.5 py-2.5 text-[15px] sm:px-3.5 focus:outline-none ${
          dark ? "text-white placeholder:text-white/60" : "text-ink placeholder:text-text-muted"
        }`}
      />
      <button type="submit" className="btn-primary min-h-[44px] shrink-0 px-4 text-sm sm:px-5">
        <span>{cta}</span>
        <span aria-hidden>→</span>
      </button>
    </form>
  );
}
