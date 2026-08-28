import { createHash } from "node:crypto";
import type { ImageFinding, ValidatedImage } from "../../domain/garment/photography.js";

function png(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || buffer.readUInt32BE(8) !== 13 || buffer.subarray(12, 16).toString("ascii") !== "IHDR") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function jpeg(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1]!;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) { offset += 2; continue; }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) return null;
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    offset += 2 + length;
  }
  return null;
}

export function validateOriginalImage(buffer: Buffer, cardVisible: boolean): ValidatedImage {
  const pngSize = png(buffer);
  const jpegSize = pngSize === null ? jpeg(buffer) : null;
  const dimensions = pngSize ?? jpegSize;
  if (dimensions === null) throw new TypeError("unsupported_or_invalid_image");
  if (dimensions.width <= 0 || dimensions.height <= 0 || dimensions.width > 20_000 || dimensions.height > 20_000 || dimensions.width * dimensions.height > 100_000_000) throw new TypeError("unsupported_or_invalid_image");
  const mediaType = pngSize === null ? "image/jpeg" : "image/png";
  const findings: ImageFinding[] = [];
  if (dimensions.width < 800 || dimensions.height < 800) findings.push({ code: "inadequate_resolution", severity: "error", message: "Use an image at least 800 × 800 pixels." });
  if (!cardVisible) findings.push({ code: "calibration_card_not_confirmed", severity: "error", message: "Retake the photograph with the calibration card fully visible." });
  if (dimensions.width / dimensions.height > 4 || dimensions.height / dimensions.width > 4) findings.push({ code: "extreme_aspect_ratio", severity: "warning", message: "The image shape suggests inadequate garment coverage." });
  return Object.freeze({ mediaType, extension: mediaType === "image/jpeg" ? ".jpg" : ".png", width: dimensions.width, height: dimensions.height, byteSize: buffer.length, contentHash: createHash("sha256").update(buffer).digest("hex"), findings: Object.freeze(findings), status: findings.some((finding) => finding.severity === "error") ? "recapture_required" : "accepted_for_analysis" });
}
