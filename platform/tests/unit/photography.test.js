"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const schemas_cjs_1 = require("../../services/photography/schemas.cjs");
const image_validation_cjs_1 = require("../../services/photography/image-validation.cjs");
const image_store_cjs_1 = require("../../services/photography/image-store.cjs");
const cleanups = [];
afterEach(async () => Promise.all(cleanups.splice(0).map((path) => (0, promises_1.rm)(path, { recursive: true, force: true }))));
function png(width, height) {
    const value = Buffer.alloc(33);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(value, 0);
    value.writeUInt32BE(13, 8);
    value.write("IHDR", 12, "ascii");
    value.writeUInt32BE(width, 16);
    value.writeUInt32BE(height, 20);
    return value;
}
describe("deterministic image gate", () => {
    test("accepts a sufficiently large PNG when card visibility is confirmed", () => {
        const result = (0, image_validation_cjs_1.validateOriginalImage)(png(1600, 1200), true);
        expect(result).toMatchObject({ mediaType: "image/png", width: 1600, height: 1200, status: "accepted_for_analysis", findings: [] });
        expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
    });
    test("stores but flags low-resolution or cardless evidence for recapture", () => {
        const result = (0, image_validation_cjs_1.validateOriginalImage)(png(640, 480), false);
        expect(result.status).toBe("recapture_required");
        expect(result.findings.map((finding) => finding.code)).toEqual(["inadequate_resolution", "calibration_card_not_confirmed"]);
    });
    test("rejects unsupported bytes and implausible dimensions", () => {
        expect(() => (0, image_validation_cjs_1.validateOriginalImage)(Buffer.from("not an image"), true)).toThrow("unsupported_or_invalid_image");
        expect(() => (0, image_validation_cjs_1.validateOriginalImage)(png(30_000, 30_000), true)).toThrow("unsupported_or_invalid_image");
    });
});
describe("private immutable image storage", () => {
    test("writes the original once and refuses overwrite", async () => {
        const root = await (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "dressed-images-"));
        cleanups.push(root);
        const store = new image_store_cjs_1.PrivateImageStore(root);
        const bytes = png(1200, 1200);
        const relativePath = await store.writeOriginal({ garmentId: "g", imageId: "i", extension: ".png", bytes });
        expect(await (0, promises_1.readFile)((0, node_path_1.join)(root, "images", relativePath))).toEqual(bytes);
        await expect(store.writeOriginal({ garmentId: "g", imageId: "i", extension: ".png", bytes })).rejects.toMatchObject({ code: "EEXIST" });
    });
    test("does not permit paths outside private storage", async () => {
        const root = await (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "dressed-images-"));
        cleanups.push(root);
        await expect(new image_store_cjs_1.PrivateImageStore(root).read("../../secret.jpg")).rejects.toThrow("invalid_image_path");
    });
});
describe("calibration profiles", () => {
    test("require at least three uniquely labelled Lab reference patches", () => {
        const profile = { name: "Card", cardType: "Known card", patches: [{ label: "A", labL: 10, labA: 0, labB: 0 }, { label: "B", labL: 50, labA: 0, labB: 0 }, { label: "C", labL: 90, labA: 0, labB: 0 }] };
        expect(schemas_cjs_1.calibrationProfileInputSchema.safeParse(profile).success).toBe(true);
        expect(schemas_cjs_1.calibrationProfileInputSchema.safeParse({ ...profile, patches: profile.patches.map((patch) => ({ ...patch, label: "same" })) }).success).toBe(false);
    });
});
