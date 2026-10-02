import { createHash } from "node:crypto";

import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import corpus from "./fixtures/qr-corpus.json";
import { fetchLogoOrFallback, generateWordmark, WORDMARK_SIZE } from "./logo";
import { COMPLIANT_PROMPT, GENERATORS, PRINT_ASSETS } from "./printAssets";
import { flowUrl, generateQrPng, generateQrSvg, qrMatrix } from "./qr";

const bitsHash = (text: string) => {
  const m = qrMatrix(text);
  let bits = "";
  for (let r = 0; r < m.size; r++) for (let c = 0; c < m.size; c++) bits += m.get(r, c) ? "1" : "0";
  return `${m.size}:${createHash("sha256").update(bits).digest("hex")}`;
};

describe("QR matrix", () => {
  // 48 URLs (several hosts, slugs from 1 to 60 chars, versions 3-8) recorded from the Python
  // `qrcode` 8.2 with ECC H: same version, same mask, same modules. That includes the Python
  // mask-selection quirks, so reprinted codes are identical to the ones FastAPI produced.
  it("is module-for-module identical to Python on the recorded corpus", () => {
    const mismatches = (corpus as { text: string; sha256: string }[]).filter((c) => !bitsHash(c.text).endsWith(c.sha256));
    expect(corpus.length).toBeGreaterThanOrEqual(48);
    expect(mismatches).toEqual([]);
  });
});

describe("QR outputs", () => {
  it("encodes the flow URL without a doubled slash", () => {
    expect(flowUrl("demo-dental")).toMatch(/^https?:\/\/[^/]+\/r\/demo-dental$/);
  });

  it("PNG is >= 1024px square, with a 4-module quiet zone, and paints exactly the matrix", async () => {
    const png = await generateQrPng("demo-dental");
    const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(info.height);
    expect(info.width).toBeGreaterThanOrEqual(1024);
    const m = qrMatrix(flowUrl("demo-dental"));
    const scale = info.width / (m.size + 8);
    expect(Number.isInteger(scale)).toBe(true);
    const at = (row: number, col: number) => data[Math.floor((row + 0.5) * scale) * info.width + Math.floor((col + 0.5) * scale)];
    for (let r = -4; r < m.size + 4; r++) {
      for (let c = -4; c < m.size + 4; c++) {
        const dark = r >= 0 && c >= 0 && r < m.size && c < m.size && m.get(r, c);
        expect(at(r + 4, c + 4) < 128).toBe(dark);
      }
    }
  });

  it("SVG has the Python document layout and one dark path per module", () => {
    const svg = generateQrSvg("demo-dental");
    const m = qrMatrix(flowUrl("demo-dental"));
    let dark = 0;
    for (let r = 0; r < m.size; r++) for (let c = 0; c < m.size; c++) if (m.get(r, c)) dark++;
    const total = (m.size + 8) * 2;
    expect(svg.startsWith("<?xml version='1.0' encoding='UTF-8'?>\n<svg ")).toBe(true);
    expect(svg).toContain(`width="${total}mm" height="${total}mm" version="1.1" viewBox="0 0 ${total} ${total}"`);
    expect(svg.match(/z(?=M|")/g)!.length).toBe(dark);
    expect(svg).toContain('d="M8,8H10V10H8z'); // finder pattern corner, 4-module quiet zone x 2 units
  });
});

describe("print assets", () => {
  const pt = (mm: number) => (mm * 72) / 25.4;
  const sizes: Record<string, [number, number]> = {
    "receipt-footer": [pt(80), pt(60)],
    "handout-card": [209.76, 297.64], // A7
    "counter-standee": [419.53, 595.28], // A5
    "counter-sticker": [pt(100), pt(100)],
  };

  it.each(PRINT_ASSETS)("%s is a one-page PDF at the Python page size", async (asset) => {
    const bytes = await GENERATORS[asset]("demo-dental", "Demo Dental");
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBeCloseTo(sizes[asset][0], 1);
    expect(height).toBeCloseTo(sizes[asset][1], 1);
  });

  it("uses the neutral prompt (CR-4/CR-5)", () => {
    expect(COMPLIANT_PROMPT).toBe("Scan to share your experience");
  });

  it("survives names the standard PDF fonts cannot encode", async () => {
    const bytes = await GENERATORS["counter-standee"]("demo-dental", "दंत चिकित्सा ₹ Clinic 😀");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});

describe("logo wordmark", () => {
  it("is a 600x200 PNG, with the business name escaped", async () => {
    const meta = await sharp(await generateWordmark(`Tom & <Jerry's> "Cafe"`)).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["png", WORDMARK_SIZE.width, WORDMARK_SIZE.height]);
  });

  it("falls back to the wordmark when there is no website", async () => {
    const meta = await sharp(await fetchLogoOrFallback("Demo", null)).metadata();
    expect(meta.width).toBe(600);
  });
});
