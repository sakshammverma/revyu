/**
 * Print assets (documents/09-DESIGN-BRIEF.md section 5): receipt footer,
 * handout card, counter standee, counter sticker. All embed the QR and neutral,
 * compliant copy, never "leave us a 5-star review" (CR-4/CR-5). Port of
 * backend/app/services/print_assets.py (reportlab -> pdf-lib); same page sizes,
 * fonts and coordinates (both use a bottom-left origin in points).
 */
import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

import { generateQrPng } from "./qr";

export const COMPLIANT_PROMPT = "Scan to share your experience";

const MM = 72 / 25.4; // reportlab.lib.units.mm
const A5: [number, number] = [419.52755905511816, 595.2755905511812];
const A7: [number, number] = [209.76377952755908, 297.6377952755906];
const RECEIPT: [number, number] = [80 * MM, 60 * MM]; // thermal-printer-safe strip
const STICKER: [number, number] = [100 * MM, 100 * MM];

export type PrintAsset = "receipt-footer" | "handout-card" | "counter-standee" | "counter-sticker";
export const PRINT_ASSETS: readonly PrintAsset[] = ["receipt-footer", "handout-card", "counter-standee", "counter-sticker"];

/** Standard PDF fonts only cover WinAnsi; unsupported characters would make pdf-lib throw, so show "?" instead. */
function encodable(font: PDFFont, text: string): string {
  const ok = new Set(font.getCharacterSet());
  return Array.from(text, (ch) => (ok.has(ch.codePointAt(0)!) ? ch : "?")).join("");
}

function centred(page: PDFPage, font: PDFFont, raw: string, size: number, y: number) {
  const text = encodable(font, raw);
  // reportlab drawCentredString: centre on page width, baseline at y.
  page.drawText(text, { x: page.getWidth() / 2 - font.widthOfTextAtSize(text, size) / 2, y, size, font });
}

async function build(
  slug: string,
  size: [number, number],
  draw: (page: PDFPage, f: { regular: PDFFont; bold: PDFFont }, qr: (x: number, y: number, side: number) => void) => void,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage(size);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const image = await pdf.embedPng(await generateQrPng(slug));
  draw(page, { regular, bold }, (x, y, side) => page.drawImage(image, { x, y, width: side, height: side }));
  return pdf.save();
}

export function generateReceiptFooter(slug: string, businessName: string) {
  const [w, h] = RECEIPT;
  return build(slug, RECEIPT, (page, f, qr) => {
    centred(page, f.regular, COMPLIANT_PROMPT, 8, h - 10 * MM);
    const side = 35 * MM;
    qr((w - side) / 2, 12 * MM, side);
    centred(page, f.regular, businessName, 6, 6 * MM);
  });
}

export function generateHandoutCard(slug: string, businessName: string) {
  const [w, h] = A7;
  return build(slug, A7, (page, f, qr) => {
    centred(page, f.bold, businessName, 12, h - 15 * MM);
    centred(page, f.regular, COMPLIANT_PROMPT, 10, h - 22 * MM);
    const side = 40 * MM;
    qr((w - side) / 2, 15 * MM, side);
  });
}

export function generateCounterStandee(slug: string, businessName: string) {
  const [w, h] = A5;
  return build(slug, A5, (page, f, qr) => {
    centred(page, f.bold, businessName, 16, h - 25 * MM);
    centred(page, f.regular, COMPLIANT_PROMPT, 14, h - 35 * MM);
    const side = 60 * MM;
    qr((w - side) / 2, 30 * MM, side);
  });
}

export function generateCounterSticker(slug: string, businessName: string) {
  const [w, h] = STICKER;
  return build(slug, STICKER, (page, f, qr) => {
    centred(page, f.regular, COMPLIANT_PROMPT, 9, h - 10 * MM);
    const side = 60 * MM;
    qr((w - side) / 2, 20 * MM, side);
    centred(page, f.regular, businessName, 7, 10 * MM);
  });
}

export const GENERATORS: Record<PrintAsset, (slug: string, businessName: string) => Promise<Uint8Array>> = {
  "receipt-footer": generateReceiptFooter,
  "handout-card": generateHandoutCard,
  "counter-standee": generateCounterStandee,
  "counter-sticker": generateCounterSticker,
};
