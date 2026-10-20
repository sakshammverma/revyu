/** FR-16: degrade gracefully if the clipboard API is unavailable. */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy path
    }
  }
  return legacyCopy(text);
}

// In-app browsers opened by QR scanner apps often have no async clipboard API. A
// hidden textarea plus execCommand("copy") still works inside a tap handler there.
function legacyCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px";
  document.body.appendChild(el);
  try {
    el.select();
    el.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(el);
  }
}
