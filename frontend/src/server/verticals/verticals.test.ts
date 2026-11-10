import { describe, expect, it } from "vitest";
import { VERTICAL_OPTIONS } from "@/lib/verticals";
import { DEFAULT_VERTICAL, listVerticals, verticalTags } from "./index";

describe("verticals", () => {
  it("signup options match the configured verticals", () => {
    expect(VERTICAL_OPTIONS.map((o) => o.key).sort()).toEqual(listVerticals());
  });

  it("defaults to the general shop tags", () => {
    expect(DEFAULT_VERTICAL).toBe("general");
    expect(verticalTags("does-not-exist")).toEqual(verticalTags("general"));
  });

  it("every vertical has fragment tags (CR-1)", () => {
    for (const v of listVerticals()) {
      const tags = verticalTags(v);
      expect(tags.length).toBeGreaterThanOrEqual(8);
      for (const t of tags) expect(t.phrases.length).toBeGreaterThanOrEqual(4);
    }
  });
});
