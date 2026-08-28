import { describe, expect, test } from "vitest";

import { categoryInputSchema, garmentInputSchema } from "../../src/domain/garment/garment.js";

const valid = {
  categoryId: "00000000-0000-4000-8000-000000000001",
  name: "Navy blazer",
  materials: [{ material: "Wool", percentage: 100 }],
  seasons: ["autumn", "winter"],
  restrictions: ["Dry clean only"],
  acquisition: { purchasePriceMinor: 25000, currency: "gbp", isGift: false },
};

describe("garment input", () => {
  test("normalises a complete deterministic garment record", () => {
    const parsed = garmentInputSchema.parse(valid);
    expect(parsed.acquisition.currency).toBe("GBP");
    expect(parsed.materials).toEqual([{ material: "Wool", percentage: 100 }]);
  });

  test("rejects duplicate materials and percentages over 100", () => {
    const result = garmentInputSchema.safeParse({ ...valid, materials: [{ material: "Wool", percentage: 70 }, { material: "wool", percentage: 40 }] });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(expect.arrayContaining(["Materials must be unique", "Material percentages cannot exceed 100"]));
  });

  test("rejects duplicate seasons", () => {
    expect(garmentInputSchema.safeParse({ ...valid, seasons: ["winter", "winter"] }).success).toBe(false);
  });
});

describe("category input", () => {
  test("keeps category extension configurable without schema changes", () => {
    expect(categoryInputSchema.parse({ name: "Traditional dress", slug: "traditional-dress" })).toMatchObject({ sortOrder: 0 });
  });

  test("rejects unstable slugs", () => {
    expect(categoryInputSchema.safeParse({ name: "Bad", slug: "Bad Slug" }).success).toBe(false);
  });
});
