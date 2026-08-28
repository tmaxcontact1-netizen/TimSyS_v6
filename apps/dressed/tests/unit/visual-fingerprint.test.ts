import sharp from "sharp";
import { describe, expect, test } from "vitest";

import { combineFingerprint, measureImage, suggestFields } from "../../src/infrastructure/images/visual-fingerprint-engine.js";

async function fixture(patterned: boolean): Promise<Buffer> {
  const width = 160, height = 240, channels = 3; const pixels = Buffer.alloc(width * height * channels, 245);
  for (let y = 20; y < 220; y++) for (let x = 55; x < 105; x++) {
    const index = (y * width + x) * channels; const active = !patterned || Math.floor(y / 8) % 2 === 0;
    pixels[index] = active ? 25 : 180; pixels[index + 1] = active ? 40 : 185; pixels[index + 2] = active ? 80 : 195;
  }
  return sharp(pixels, { raw: { width, height, channels } }).png().toBuffer();
}

describe("classical visual fingerprint", () => {
  test("is byte-for-byte deterministic for identical evidence", async () => {
    const image = await fixture(false); const first = await measureImage(image); const second = await measureImage(image);
    expect(second).toEqual(first);
    expect(first.foregroundAspectRatio).toBeCloseTo(0.25, 1);
    expect(first.palette[0]?.label).toBe("white");
  });

  test("measures stripes as more complex and less solid", async () => {
    const solid = await measureImage(await fixture(false)); const striped = await measureImage(await fixture(true));
    expect(striped.edgeDensity).toBeGreaterThan(solid.edgeDensity);
    expect(striped.visualComplexity).toBeGreaterThan(solid.visualComplexity);
    expect(striped.solidConfidence).toBeLessThan(solid.solidConfidence);
  });

  test("combines whole and detail evidence and emits conservative editable suggestions", async () => {
    const whole = await measureImage(await fixture(false)); const detail = await measureImage(await fixture(true));
    const fingerprint = combineFingerprint(whole, detail); const suggestions = suggestFields(fingerprint);
    expect(fingerprint.confidence).toBe(0.9);
    expect(suggestions.map((suggestion) => suggestion.field)).toEqual(["category", "formality", "seasons"]);
    expect(suggestions[0]?.confidence).toBeLessThan(0.7);
    expect((suggestions[0]?.value as Array<{ slug: string }>)[0]?.slug).toBe("ties");
  });
});
