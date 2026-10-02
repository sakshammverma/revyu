/**
 * QR generation (FR-37/38). SVG and PNG >= 1024px, high error correction:
 * receipts crease, fold, and smudge. Quiet zone preserved. Port of
 * backend/app/services/qr.py; the module matrix is the same as the Python
 * `qrcode` package produces for the same input (verified in parity checks).
 */
import QRCode from "qrcode";

import { getEnv } from "@/server/env";

export const MIN_PNG_SIZE_PX = 1024;
const BORDER = 4; // modules of quiet zone (QR spec minimum)

export function flowUrl(slug: string): string {
  // PUBLIC_FLOW_BASE_URL is the real domain in production.
  return `${getEnv().publicFlowBaseUrl.replace(/\/+$/, "")}/r/${slug}`;
}

type Grid = boolean[][];

/** Python qrcode scores each candidate mask with the format/version bits and dark module left light. */
function blankReserved(g: Grid): void {
  const n = g.length;
  for (let i = 0; i < 15; i++) {
    if (i < 6) g[i][8] = false;
    else if (i < 8) g[i + 1][8] = false;
    else g[n - 15 + i][8] = false;
    if (i < 8) g[8][n - i - 1] = false;
    else if (i < 9) g[8][15 - i] = false;
    else g[8][15 - i - 1] = false;
  }
  g[n - 8][8] = false;
  if (n >= 45) {
    // version >= 7 carries two 3x6 version-information blocks
    for (let i = 0; i < 18; i++) {
      g[Math.floor(i / 3)][(i % 3) + n - 11] = false;
      g[(i % 3) + n - 11][Math.floor(i / 3)] = false;
    }
  }
}

/** python-qrcode util.lost_point(): same four penalty rules, same skip-ahead optimisations. */
function lostPoint(g: Grid): number {
  const n = g.length;
  let lost = 0;

  // Rule 1: runs of >= 5 same-colour modules.
  const runs = new Array<number>(n + 1).fill(0);
  const scan = (at: (i: number, j: number) => boolean) => {
    for (let i = 0; i < n; i++) {
      let prev = at(i, 0);
      let len = 0;
      for (let j = 0; j < n; j++) {
        if (at(i, j) === prev) len++;
        else {
          if (len >= 5) runs[len]++;
          len = 1;
          prev = at(i, j);
        }
      }
      if (len >= 5) runs[len]++;
    }
  };
  scan((i, j) => g[i][j]);
  scan((i, j) => g[j][i]);
  for (let len = 5; len <= n; len++) lost += runs[len] * (len - 2);

  // Rule 2: 2x2 blocks of one colour (a mismatching right column skips the next block).
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const tr = g[r][c + 1];
      if (tr !== g[r + 1][c + 1]) c++;
      else if (tr !== g[r][c]) continue;
      else if (tr !== g[r + 1][c]) continue;
      else lost += 3;
    }
  }

  // Rule 3: finder-like 1:1:3:1:1 patterns with a light margin (rows, then columns).
  const finder = (at: (k: number) => boolean): boolean =>
    !at(1) && at(4) && !at(5) && at(6) && !at(9) &&
    ((at(0) && at(2) && at(3) && !at(7) && !at(8) && !at(10)) ||
      (!at(0) && !at(2) && !at(3) && at(7) && at(8) && at(10)));
  for (let line = 0; line < n; line++) {
    for (const get of [(k: number) => g[line][k], (k: number) => g[k][line]]) {
      for (let k = 0; k < n - 10; k++) {
        if (finder((o) => get(k + o))) lost += 40;
        if (get(k + 10)) k++;
      }
    }
  }

  // Rule 4: dark/light balance.
  let dark = 0;
  for (const row of g) for (const v of row) if (v) dark++;
  lost += Math.trunc(Math.abs((dark / (n * n)) * 100 - 50) / 5) * 10;
  return lost;
}

type EcLevel = "L" | "M" | "Q" | "H";
type QrSegments = { data: string; mode: "numeric" | "alphanumeric" | "byte" }[];

function createWithMask(text: string | QrSegments, mask?: number, level: EcLevel = "H") {
  return QRCode.create(text as string, {
    errorCorrectionLevel: level,
    ...(mask === undefined ? {} : { maskPattern: mask as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 }),
  });
}

/**
 * Mask choice of the Python package (first lowest penalty). The npm `qrcode`
 * scores masks slightly differently and would pick another valid mask for
 * ~40% of URLs; choosing Python's keeps every code module-for-module identical
 * to what FastAPI produced, so reprints never look different.
 */
function pythonMask(text: string | QrSegments, level: EcLevel = "H"): number {
  let best = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const { modules } = createWithMask(text, mask, level);
    const g: Grid = Array.from({ length: modules.size }, (_, r) =>
      Array.from({ length: modules.size }, (_, c) => modules.get(r, c) === 1),
    );
    blankReserved(g);
    const score = lostPoint(g);
    if (score < bestScore) {
      bestScore = score;
      best = mask;
    }
  }
  return best;
}

/** Dark/light module matrix, error correction H, smallest version that fits. */
export function qrMatrix(text: string): { size: number; mask: number; get: (row: number, col: number) => boolean } {
  const mask = pythonMask(text);
  const { modules } = createWithMask(text, mask);
  return { size: modules.size, mask, get: (r, c) => modules.get(r, c) === 1 };
}

/**
 * PNG >= 1024px per side (FR-38). The scale is derived from the real module
 * count, since a fixed scale does not guarantee a minimum size across versions.
 */
export async function generateQrPng(slug: string): Promise<Buffer> {
  const text = flowUrl(slug);
  const { size, mask } = qrMatrix(text);
  const scale = Math.ceil(MIN_PNG_SIZE_PX / (size + 2 * BORDER));
  return QRCode.toBuffer(text, {
    errorCorrectionLevel: "H",
    maskPattern: mask as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7,
    margin: BORDER,
    scale,
    type: "png",
  });
}

/** Same document layout as the Python SvgPathImage (2 units per module, one path). */
export function generateQrSvg(slug: string): string {
  const { size, get } = qrMatrix(flowUrl(slug));
  const unit = 2;
  const total = (size + 2 * BORDER) * unit;
  let d = "";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!get(r, c)) continue;
      const x = (c + BORDER) * unit;
      const y = (r + BORDER) * unit;
      d += `M${x},${y}H${x + unit}V${y + unit}H${x}z`;
    }
  }
  return (
    `<?xml version='1.0' encoding='UTF-8'?>\n` +
    `<svg width="${total}mm" height="${total}mm" version="1.1" viewBox="0 0 ${total} ${total}" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="${d}" id="qr-path" fill="#000000" fill-opacity="1" fill-rule="nonzero" stroke="none" /></svg>`
  );
}

/**
 * python-qrcode splits its input into numeric / alphanumeric / byte chunks
 * (util.optimal_data_chunks, QRCode.add_data optimize=20) before encoding. Passing the same
 * chunks keeps the module matrix identical for mixed text such as "A7F3-123456".
 */
const MIN_RUN = 20;

export function pythonChunks(text: string): QrSegments {
  if (/[^\x00-\x7f]/.test(text)) return [{ data: text, mode: "byte" }];
  const short = text.length <= MIN_RUN;
  const numRe = short ? /^\d+$/ : new RegExp(`\\d{${MIN_RUN},}`);
  const alnumRe = short ? /^[0-9A-Z $%*+\-./:]+$/ : new RegExp(`[0-9A-Z $%*+\\-./:]{${MIN_RUN},}`);
  const split = (data: string, re: RegExp): [boolean, string][] => {
    const out: [boolean, string][] = [];
    while (data) {
      const m = re.exec(data);
      if (!m) break;
      if (m.index) out.push([false, data.slice(0, m.index)]);
      out.push([true, m[0]]);
      data = data.slice(m.index + m[0].length);
    }
    if (data) out.push([false, data]);
    return out;
  };
  const segments: QrSegments = [];
  for (const [isNum, chunk] of split(text, numRe)) {
    if (isNum) segments.push({ data: chunk, mode: "numeric" });
    else
      for (const [isAlnum, sub] of split(chunk, alnumRe))
        segments.push({ data: sub, mode: isAlnum ? "alphanumeric" : "byte" });
  }
  return segments;
}

/**
 * Port of python `qrcode.make(text, image_factory=SvgPathImage, box_size, border)`
 * with the library's default error correction (M), as used for wallet codes.
 * Coordinates are pixel units / 10, printed like Python's Decimal.
 */
export function generateTextQrSvg(text: string, boxSize = 8, border = 2): string {
  const segments = pythonChunks(text);
  const mask = pythonMask(segments, "M");
  const { modules } = createWithMask(segments, mask, "M");
  const size = modules.size;
  const u = (px: number) => String(px / 10);
  const total = u((size + 2 * border) * boxSize);
  let d = "";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules.get(r, c) !== 1) continue;
      const x0 = (c + border) * boxSize;
      const y0 = (r + border) * boxSize;
      d += `M${u(x0)},${u(y0)}H${u(x0 + boxSize)}V${u(y0 + boxSize)}H${u(x0)}z`;
    }
  }
  return (
    `<?xml version='1.0' encoding='UTF-8'?>\n` +
    `<svg width="${total}mm" height="${total}mm" version="1.1" viewBox="0 0 ${total} ${total}" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="${d}" id="qr-path" fill="#000000" fill-opacity="1" fill-rule="nonzero" stroke="none" /></svg>`
  );
}
