import QRCode from "qrcode";

import { siteUrl } from "@/lib/seo";

/** One SVG path for a whole QR code: crisp at any size, no image request. */
export function qrPath(text: string): { size: number; d: string } {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  let d = "";
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (modules.data[y * modules.size + x]) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { size: modules.size, d };
}

export type QrShape = { size: number; d: string };

/** The code on the marketing standee and in the phone demos: it opens /demo. Call it on the server, so the QR library stays out of the browser bundle. */
export function demoQr(): QrShape {
  return qrPath(`${siteUrl.replace(/\/+$/, "")}/demo`);
}
