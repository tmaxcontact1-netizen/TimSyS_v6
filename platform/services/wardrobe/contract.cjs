"use strict";
const { z } = require("zod");
const domain = require("./schemas.cjs");
const text = z.string().max(4000),
  nullable = text.nullable(),
  uuid = z.string().uuid(),
  number = z.number().finite(),
  nullableNumber = number.nullable();
const category = z
  .object({
    id: uuid,
    parentCategoryId: uuid.nullable(),
    name: z.string().max(80),
    slug: z.string().max(200),
    sortOrder: z.number().int(),
    isActive: z.boolean(),
  })
  .strict();
const use = z
  .object({ id: uuid, slug: z.string().max(200), name: z.string().max(120) })
  .strict();
const garment = z
  .object({
    id: uuid,
    categoryId: uuid,
    categoryName: text,
    name: text,
    brand: nullable,
    productName: nullable,
    sku: nullable,
    notes: nullable,
    formality: nullableNumber,
    fit: nullable,
    size: nullable,
    tailoringNotes: nullable,
    materials: z
      .array(z.object({ material: text, percentage: nullableNumber }).strict())
      .max(20),
    seasons: z.array(text).max(5),
    uses: z.array(use).max(30),
    restrictions: z.array(text).max(30),
    acquisition: z
      .object({
        condition: nullable,
        purchaseDate: nullable,
        purchasePriceMinor: nullableNumber,
        currency: nullable,
        originalRetailPriceMinor: nullableNumber,
        source: nullable,
        isGift: z.boolean(),
        notes: nullable,
      })
      .strict(),
    status: text,
    version: z.number().int().positive(),
    createdAt: text,
    updatedAt: text,
  })
  .strict();
const empty = z.object({}).strict();
const shapes = {
  categories: {
    input: empty,
    output: z.object({ items: z.array(category).max(1000) }).strict(),
  },
  uses: {
    input: empty,
    output: z
      .object({
        items: z.array(use.extend({ sort_order: z.number().int() })).max(1000),
      })
      .strict(),
  },
  list: {
    input: z
      .object({
        search: z.string().max(200).optional(),
        categoryId: uuid.optional(),
        useId: uuid.optional(),
        status: z
          .enum(["available", "unavailable", "archived", "all"])
          .optional(),
        limit: z.number().int().min(1).max(50),
        offset: z.number().int().nonnegative().max(1000000),
      })
      .strict(),
    output: z
      .object({
        items: z.array(garment).max(50),
        total: z.number().int().nonnegative(),
        limit: z.number().int(),
        offset: z.number().int(),
      })
      .strict(),
  },
  get: { input: z.object({ id: uuid }).strict(), output: garment },
  create_category: {
    input: domain.categoryInputSchema,
    output: category,
    command: true,
  },
  create: { input: domain.garmentInputSchema, output: garment, command: true },
  update: {
    input: z.object({ id: uuid, garment: domain.garmentUpdateSchema }).strict(),
    output: garment,
    command: true,
  },
  archive: {
    input: z
      .object({ id: uuid, version: z.number().int().positive() })
      .strict(),
    output: z.object({ archived: z.literal(true) }).strict(),
    command: true,
  },
  delete: {
    input: z
      .object({ id: uuid, version: z.number().int().positive() })
      .strict(),
    output: z.object({ deleted: z.literal(true) }).strict(),
    command: true,
  },
};
function schema(value) {
  const json = z.toJSONSchema(value, { io: "input", unrepresentable: "any" });
  function clean(s) {
    delete s.$schema;
    delete s.default;
    if (s.type === "object") {
      s.required ||= [];
      s.additionalProperties = false;
      Object.values(s.properties || {}).forEach(clean);
    }
    if (s.type === "array") {
      s.maxItems ??= 1000;
      clean(s.items);
    }
    if (s.anyOf) s.anyOf.forEach(clean);
    return s;
  }
  return clean(json);
}
const operations = Object.fromEntries(
  Object.entries(shapes).map(([name, s]) => [
    name,
    {
      permission: s.command
        ? "service:wardrobe:write"
        : "service:wardrobe:read",
      effect: s.command ? "command" : "read",
      ...(s.command ? { idempotency: "required" } : {}),
      timeoutMs: 10000,
      maximumInputBytes: 32768,
      maximumOutputBytes: 1048576,
      input: schema(s.input),
      output: schema(s.output),
    },
  ]),
);
module.exports = {
  contract: {
    serviceId: "wardrobe",
    version: "1.0.0",
    owner: "timsys",
    apps: ["dressed"],
    operations,
  },
  shapes,
};
