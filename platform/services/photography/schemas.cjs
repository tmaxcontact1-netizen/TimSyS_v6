"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calibrationProfileInputSchema = void 0;
const zod_1 = require("zod");
exports.calibrationProfileInputSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(120),
    cardType: zod_1.z.string().trim().min(1).max(120),
    notes: zod_1.z.string().trim().min(1).max(2_000).optional().nullable(),
    patches: zod_1.z.array(zod_1.z.object({
        label: zod_1.z.string().trim().min(1).max(80),
        labL: zod_1.z.number().min(0).max(100),
        labA: zod_1.z.number().min(-160).max(160),
        labB: zod_1.z.number().min(-160).max(160),
    }).strict()).min(3).max(100),
}).strict().superRefine((value, context) => {
    const labels = value.patches.map((patch) => patch.label.toLocaleLowerCase());
    if (new Set(labels).size !== labels.length)
        context.addIssue({ code: "custom", path: ["patches"], message: "Patch labels must be unique" });
});
