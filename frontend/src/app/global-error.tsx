"use client";

// Last resort when the root layout itself fails. It replaces the whole
// document, so global CSS and fonts are not available: inline styles only.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f2f7f7", color: "#1a1e23" }}>
        <title>Something went wrong — Revyu</title>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div
            role="alert"
            style={{ background: "#fff", border: "1px solid #e8ecec", borderRadius: 16, padding: 32, maxWidth: 420, textAlign: "center" }}
          >
            <h1 style={{ fontSize: 22, margin: 0 }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: "#515a63", marginTop: 8 }}>Please try again in a moment.</p>
            <button
              onClick={() => retry()}
              style={{ marginTop: 20, minHeight: 48, width: "100%", border: 0, borderRadius: 8, background: "#2f6df0", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
            >
              Try again
            </button>
            {error.digest && <p style={{ fontSize: 12, color: "#6e797b", marginTop: 16 }}>Reference: {error.digest}</p>}
          </div>
        </main>
      </body>
    </html>
  );
}
