import { describe, expect, it } from "vitest";
import { BoundedMap } from "../../src/infrastructure/bounded-map.js";

describe("bounded in-memory retention", () => {
  it("evicts oldest accepted-quote state under sustained high volume", () => {
    const retained = new BoundedMap<number, string>(64);
    for (let index = 0; index < 100_000; index += 1) retained.set(index, `quote-${index}`);
    expect(retained.size).toBe(64);
    expect(retained.get(99_935)).toBeUndefined();
    expect(retained.get(99_936)).toBe("quote-99936");
    expect(retained.get(99_999)).toBe("quote-99999");
  });
});
