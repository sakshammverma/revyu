// Renders marketing mockups of Revyu's four real print files (same sizes, copy
// and QR placement as frontend/src/server/services/printAssets.ts).
// Usage (from frontend/): node scripts/print-mockups.mjs .
// Keep in step with printAssets.ts if the print layouts change.
import path from "node:path";
import { createRequire } from "node:module";

const frontend = path.resolve(process.argv[2] ?? ".");
const require = createRequire(path.join(frontend, "package.json"));
const sharp = require("sharp");
const QRCode = require("qrcode");
sharp.cache(false);

const W = 2100, H = 900;
const NAME = "Sharma General Store";
const PROMPT = "Scan to share your experience";
const QR_TEXT = "Revyu example. Your own QR opens your own review page.";
const FONT = "Helvetica, Arial, sans-serif";
const PT = 25.4 / 72; // mm per point

const qrInner = await (async () => {
  const svg = await QRCode.toString(QR_TEXT, { type: "svg", errorCorrectionLevel: "H", margin: 0, color: { dark: "#111111", light: "#ffffff" } });
  const viewBox = svg.match(/viewBox="([^"]+)"/)[1];
  const body = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return { viewBox, body };
})();

/** One print piece: size in mm, rendered at `scale` px/mm with its top-left at (x, y). Items use the PDF's bottom-left mm coordinates. */
function piece({ w, h }, scale, x, y, items, { rotate = 0, radius = 2, fill = "#ffffff" } = {}) {
  const px = (mm) => mm * scale;
  const yy = (mmFromBottom) => px(h - mmFromBottom);
  const parts = items.map((it) => {
    if (it.qr) {
      const side = px(it.side);
      return `<svg x="${px((w - it.side) / 2)}" y="${yy(it.y + it.side)}" width="${side}" height="${side}" viewBox="${qrInner.viewBox}">${qrInner.body}</svg>`;
    }
    return `<text x="${px(w / 2)}" y="${yy(it.y)}" text-anchor="middle" font-family="${FONT}" font-size="${px(it.size * PT)}" font-weight="${it.bold ? 700 : 400}" fill="#1a1e23">${it.text}</text>`;
  });
  const cx = px(w) / 2, cy = px(h) / 2;
  return `<g transform="translate(${x} ${y}) rotate(${rotate} ${cx} ${cy})">
    <rect width="${px(w)}" height="${px(h)}" rx="${px(radius)}" fill="${fill}" filter="url(#shadow)"/>
    ${parts.join("\n")}
  </g>`;
}

const standee = (scale, x, y, rotate = 0) =>
  piece({ w: 148, h: 210 }, scale, x, y, [
    { text: NAME, size: 16, bold: true, y: 210 - 25 },
    { text: PROMPT, size: 14, y: 210 - 35 },
    { qr: true, side: 60, y: 30 },
  ], { rotate });
const card = (scale, x, y, rotate = 0) =>
  piece({ w: 74, h: 105 }, scale, x, y, [
    { text: NAME, size: 12, bold: true, y: 105 - 15 },
    { text: PROMPT, size: 10, y: 105 - 22 },
    { qr: true, side: 40, y: 15 },
  ], { rotate, radius: 3 });
const sticker = (scale, x, y, rotate = 0) =>
  piece({ w: 100, h: 100 }, scale, x, y, [
    { text: PROMPT, size: 9, y: 100 - 10 },
    { qr: true, side: 60, y: 20 },
    { text: NAME, size: 7, y: 10 },
  ], { rotate, radius: 6 });
const receiptFooter = (scale, x, y) =>
  piece({ w: 80, h: 60 }, scale, x, y, [
    { text: PROMPT, size: 8, y: 60 - 10 },
    { qr: true, side: 35, y: 12 },
    { text: NAME, size: 6, y: 6 },
  ], { radius: 0 });

function scene(background, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#16202a" flood-opacity="0.22"/>
    </filter>
    <radialGradient id="glow" cx="62%" cy="38%" r="70%">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe7ea"/>
    </radialGradient>
  </defs>
  ${background}
  ${content}
</svg>`;
}
const studio = `<rect width="${W}" height="${H}" fill="url(#glow)"/>`;
const counterTop = `${studio}<rect y="${H * 0.78}" width="${W}" height="${H * 0.22}" fill="#cfd8dc"/>`;

const out = (name) => path.join(frontend, "public", "images", `${name}.jpg`);
const CX = 1680; // pieces sit right of the overlaid text column (left ~60%)
const jobs = {
  // Billing counter: A5 standee on a small stand, on the counter.
  "print-counter-standee": scene(
    `${counterTop}<rect x="${CX - 130}" y="${H * 0.78 - 16}" width="260" height="24" rx="6" fill="#9aa6ab"/>`,
    standee(2.75, CX - (148 * 2.75) / 2, H * 0.78 - 210 * 2.75 - 6),
  ),
  // Bill or receipt: the footer printed at the end of a till receipt.
  "print-receipt-footer": scene(
    studio,
    `<g filter="url(#shadow)"><rect x="${CX - 160}" y="-40" width="320" height="${H - 120}" fill="#ffffff"/></g>
     ${Array.from({ length: 7 }, (_, i) => `<rect x="${CX - 130}" y="${30 + i * 34}" width="${i % 3 === 2 ? 140 : 260}" height="10" rx="5" fill="#d7dee1"/>`).join("")}
     <line x1="${CX - 130}" y1="285" x2="${CX + 130}" y2="285" stroke="#c4ccd0" stroke-width="3" stroke-dasharray="10 8"/>
     ${receiptFooter(4, CX - 160, 305).replace('filter="url(#shadow)"', "")}`,
  ),
  // Table or shelf: handout cards, fanned.
  "print-handout-card": scene(
    counterTop,
    `${card(4.6, CX - 330, 110, -8)}${card(4.6, CX - 20, 90, 6)}`,
  ),
  // Packaging: the sticker on a kraft bag.
  "print-counter-sticker": scene(
    studio,
    `<path d="M ${CX - 230} 210 L ${CX + 230} 210 L ${CX + 270} ${H + 20} L ${CX - 270} ${H + 20} Z" fill="#c9a77c" filter="url(#shadow)"/>
     <path d="M ${CX - 100} 210 C ${CX - 100} 90, ${CX + 100} 90, ${CX + 100} 210" fill="none" stroke="#a7855c" stroke-width="16"/>
     ${sticker(3.1, CX - 155, 300, -3)}`,
  ),
  // Any business: all four files together.
  "print-kit-all": scene(
    counterTop,
    `${standee(2.1, CX - 400, 120)}${receiptFooter(2.6, CX - 40, 60)}${card(3.1, CX - 60, 300, 7)}${sticker(2.0, CX + 190, 430, -6)}`,
  ),
};

for (const [name, svg] of Object.entries(jobs)) {
  await sharp(Buffer.from(svg)).jpeg({ quality: 84, mozjpeg: true }).toFile(out(name));
  console.log("wrote", name);
}
