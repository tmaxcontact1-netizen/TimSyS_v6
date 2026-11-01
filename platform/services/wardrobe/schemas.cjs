"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryInputSchema =
  exports.garmentUpdateSchema =
  exports.garmentInputSchema =
  exports.materialSchema =
  exports.seasonSchema =
    void 0;
const zod_1 = require("zod");
const optionalText = (maximum) =>
  zod_1.z.string().trim().min(1).max(maximum).optional().nullable();
const money = zod_1.z.number().int().nonnegative().safe().optional().nullable();
exports.seasonSchema = zod_1.z.enum([
  "spring",
  "summer",
  "autumn",
  "winter",
  "all-season",
]);
exports.materialSchema = zod_1.z
  .object({
    material: zod_1.z.string().trim().min(1).max(80),
    percentage: zod_1.z.number().positive().max(100).optional().nullable(),
  })
  .strict();
exports.garmentInputSchema = zod_1.z
  .object({
    categoryId: zod_1.z.string().uuid(),
    name: zod_1.z.string().trim().min(1).max(120),
    brand: optionalText(120),
    productName: optionalText(120),
    sku: optionalText(120),
    notes: optionalText(4_000),
    formality: zod_1.z.number().int().min(1).max(5).optional().nullable(),
    fit: optionalText(80),
    size: optionalText(80),
    tailoringNotes: optionalText(2_000),
    materials: zod_1.z.array(exports.materialSchema).max(20).default([]),
    seasons: zod_1.z.array(exports.seasonSchema).max(5).default([]),
    useIds: zod_1.z.array(zod_1.z.string().uuid()).max(30).default([]),
    restrictions: zod_1.z
      .array(zod_1.z.string().trim().min(1).max(240))
      .max(30)
      .default([]),
    acquisition: zod_1.z
      .object({
        condition: zod_1.z.enum(["new", "used"]).optional().nullable(),
        purchaseDate: zod_1.z.iso.date().optional().nullable(),
        purchasePriceMinor: money,
        currency: zod_1.z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]{3}$/)
          .optional()
          .nullable(),
        originalRetailPriceMinor: money,
        source: optionalText(160),
        isGift: zod_1.z.boolean().default(false),
        notes: optionalText(2_000),
      })
      .strict()
      .default({ isGift: false }),
  })
  .strict()
  .superRefine((value, context) => {
    const materialNames = value.materials.map((item) =>
      item.material.toLocaleLowerCase(),
    );
    if (new Set(materialNames).size !== materialNames.length)
      context.addIssue({
        code: "custom",
        path: ["materials"],
        message: "Materials must be unique",
      });
    const known = value.materials.flatMap((item) =>
      item.percentage == null ? [] : [item.percentage],
    );
    if (known.reduce((sum, percentage) => sum + percentage, 0) > 100.001)
      context.addIssue({
        code: "custom",
        path: ["materials"],
        message: "Material percentages cannot exceed 100",
      });
    if (new Set(value.seasons).size !== value.seasons.length)
      context.addIssue({
        code: "custom",
        path: ["seasons"],
        message: "Seasons must be unique",
      });
    if (new Set(value.useIds).size !== value.useIds.length)
      context.addIssue({
        code: "custom",
        path: ["useIds"],
        message: "Uses must be unique",
      });
  });
exports.garmentUpdateSchema = exports.garmentInputSchema.safeExtend({
  version: zod_1.z.number().int().positive(),
});
exports.categoryInputSchema = zod_1.z
  .object({
    name: zod_1.z.string().trim().min(1).max(80),
    slug: zod_1.z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    parentCategoryId: zod_1.z.string().uuid().optional().nullable(),
    sortOrder: zod_1.z.number().int().min(0).max(100_000).default(0),
  })
  .strict();
