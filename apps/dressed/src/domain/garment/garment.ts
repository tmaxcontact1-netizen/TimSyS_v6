import { z } from "zod";

const optionalText = (maximum: number) => z.string().trim().min(1).max(maximum).optional().nullable();
const money = z.number().int().nonnegative().safe().optional().nullable();

export const seasonSchema = z.enum(["spring", "summer", "autumn", "winter", "all-season"]);
export const materialSchema = z.object({
  material: z.string().trim().min(1).max(80),
  percentage: z.number().positive().max(100).optional().nullable(),
}).strict();

export const garmentInputSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  brand: optionalText(120),
  productName: optionalText(120),
  sku: optionalText(120),
  notes: optionalText(4_000),
  formality: z.number().int().min(1).max(5).optional().nullable(),
  fit: optionalText(80),
  size: optionalText(80),
  tailoringNotes: optionalText(2_000),
  materials: z.array(materialSchema).max(20).default([]),
  seasons: z.array(seasonSchema).max(5).default([]),
  restrictions: z.array(z.string().trim().min(1).max(240)).max(30).default([]),
  acquisition: z.object({
    condition: z.enum(["new", "used"]).optional().nullable(),
    purchaseDate: z.iso.date().optional().nullable(),
    purchasePriceMinor: money,
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional().nullable(),
    originalRetailPriceMinor: money,
    source: optionalText(160),
    isGift: z.boolean().default(false),
    notes: optionalText(2_000),
  }).strict().default({ isGift: false }),
}).strict().superRefine((value, context) => {
  const materialNames = value.materials.map((item) => item.material.toLocaleLowerCase());
  if (new Set(materialNames).size !== materialNames.length) context.addIssue({ code: "custom", path: ["materials"], message: "Materials must be unique" });
  const known = value.materials.flatMap((item) => item.percentage == null ? [] : [item.percentage]);
  if (known.reduce((sum, percentage) => sum + percentage, 0) > 100.001) context.addIssue({ code: "custom", path: ["materials"], message: "Material percentages cannot exceed 100" });
  if (new Set(value.seasons).size !== value.seasons.length) context.addIssue({ code: "custom", path: ["seasons"], message: "Seasons must be unique" });
});

export const garmentUpdateSchema = garmentInputSchema.and(z.object({ version: z.number().int().positive() }).strict());
export type GarmentInput = z.infer<typeof garmentInputSchema>;
export type GarmentUpdate = z.infer<typeof garmentUpdateSchema>;

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  parentCategoryId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().min(0).max(100_000).default(0),
}).strict();
export type CategoryInput = z.infer<typeof categoryInputSchema>;
