import { ImageResponse } from "next/og";

export const alt = "Revyu: a printed QR that helps customers write their own Google reviews";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Shown when a Revyu link is shared. Claims nothing about outcomes (documents/03-COMPLIANCE.md).
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#f2f7f7",
          color: "#1a1e23",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 40, fontWeight: 700 }}>
          <div style={{ width: 20, height: 20, borderRadius: 10, background: "#2f6df0" }} />
          Revyu
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, lineHeight: 1.08, fontWeight: 700, maxWidth: 980 }}>
            A printed QR that helps customers write their own Google reviews.
          </div>
          <div style={{ fontSize: 34, color: "#515a63" }}>
            Google link at every rating. Flat monthly price. 15-day free trial.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
