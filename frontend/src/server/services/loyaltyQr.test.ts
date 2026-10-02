/**
 * The wallet code QR must be byte-identical to python-qrcode's
 * SvgPathImage(box_size=8, border=2) output. Hashes below were produced by the
 * Python package for the same strings (first 16 hex chars of sha256).
 */
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { generateTextQrSvg, pythonChunks } from "./qr";

const FROM_PYTHON: Record<string, string> = {
  "A7F3-123456": "bb3d3a60b19a3ab3",
  "ZZZZ-000000": "8c9ab72aef21f08a",
  "2345-678901": "06ae214eb114913f",
  "K9M2-045310": "005b0ba3ae2ee7c0",
  "WK3D-075954": "f6672425d44652ad",
  "GZDP-039317": "f7251ffbdb4f368d",
  "F54E-252353": "dbac6fd6e3cb061b",
  "F5DH-993473": "b8380d2e009b17ed",
  "QD3D-231821": "5ea9b4727f4c9475",
  "CJU4-151262": "e7deeda412ccca3d",
  "HVMG-609851": "14c5dcc8de1e1466",
  "NZGE-591783": "8e8305068c0b01e6",
  "DP95-814983": "2b4a43a564b06738",
  "W77Z-314328": "5d01d4d749822b83",
  "RMRF-602326": "63fb4ef4ff577dff",
  "V9X6-301924": "8f0da2f46ffc2f67",
  "EH4L-793919": "99a6a74d52215438",
  "XK94-041111": "be93b39f0b94767d",
  "EWXY-623241": "b6b160a6e2edd1c9",
  "97EF-990569": "edd5aa80feb73b69",
};

describe("wallet code QR svg", () => {
  it.each(Object.entries(FROM_PYTHON))("matches python-qrcode for %s", (text, hash) => {
    expect(createHash("sha256").update(generateTextQrSvg(text)).digest("hex").slice(0, 16)).toBe(hash);
  });

  it("uses one alphanumeric chunk for short codes (python-qrcode optimize=20)", () => {
    expect(pythonChunks("A7F3-123456")).toEqual([{ data: "A7F3-123456", mode: "alphanumeric" }]);
    expect(pythonChunks("ab")).toEqual([{ data: "ab", mode: "byte" }]);
  });
});
