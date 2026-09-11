import sharp from "sharp";
import { describe, expect, test } from "vitest";

import { analyseCalibrationCard, combineFingerprint, measureImage, suggestFields } from "../../src/infrastructure/images/visual-fingerprint-engine.js";

async function fixture(patterned: boolean): Promise<Buffer> {
  const width = 160, height = 240, channels = 3; const pixels = Buffer.alloc(width * height * channels, 245);
  for (let y = 20; y < 220; y++) for (let x = 55; x < 105; x++) {
    const index = (y * width + x) * channels; const active = !patterned || Math.floor(y / 8) % 2 === 0;
    pixels[index] = active ? 25 : 180; pixels[index + 1] = active ? 40 : 185; pixels[index + 2] = active ? 80 : 195;
  }
  return sharp(pixels, { raw: { width, height, channels } }).png().toBuffer();
}

describe("classical visual fingerprint", () => {
  test("finds red, green and blue reference blocks without asking the user for colour values", async () => {
    const width=360,height=300,channels=3,pixels=Buffer.alloc(width*height*channels,245);
    const blocks:[[number,number,number],[number,number,number],[number,number,number]]=[[220,35,35],[35,190,55],[35,60,220]];
    blocks.forEach((colour,index)=>{const startX=45+index*105;for(let y=100;y<200;y++)for(let x=startX;x<startX+60;x++){const offset=(y*width+x)*channels;pixels[offset]=colour[0];pixels[offset+1]=colour[1];pixels[offset+2]=colour[2];}});
    const patches=await analyseCalibrationCard(await sharp(pixels,{raw:{width,height,channels}}).png().toBuffer());
    expect(patches.map(patch=>patch.label)).toEqual(["Red","Green","Blue"]);
  });

  test("rejects unrelated colour regions that do not form a calibration card", async () => {
    const width=360,height=300,channels=3,pixels=Buffer.alloc(width*height*channels,210);
    const regions=[{x:15,y:20,w:70,h:70,c:[220,35,35]},{x:250,y:15,w:55,h:55,c:[35,190,55]},{x:180,y:220,w:70,h:45,c:[35,60,220]}] as const;
    for(const region of regions)for(let y=region.y;y<region.y+region.h;y++)for(let x=region.x;x<region.x+region.w;x++){const offset=(y*width+x)*channels;pixels[offset]=region.c[0];pixels[offset+1]=region.c[1];pixels[offset+2]=region.c[2];}
    await expect(analyseCalibrationCard(await sharp(pixels,{raw:{width,height,channels}}).png().toBuffer())).rejects.toThrow("calibration_card_geometry_invalid");
  });

  test("finds a rotated three-patch card", async () => {
    const width=400,height=400,channels=3,pixels=Buffer.alloc(width*height*channels,235),colours=[[220,35,35],[35,190,55],[35,60,220]] as const;
    colours.forEach((colour,index)=>{const centre=90+index*105;for(let y=centre-28;y<centre+28;y++)for(let x=170;x<230;x++){const offset=(y*width+x)*channels;pixels[offset]=colour[0];pixels[offset+1]=colour[1];pixels[offset+2]=colour[2];}});
    const patches=await analyseCalibrationCard(await sharp(pixels,{raw:{width,height,channels}}).png().toBuffer());
    expect(patches.map(patch=>patch.label)).toEqual(["Red","Green","Blue"]);
  });

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
