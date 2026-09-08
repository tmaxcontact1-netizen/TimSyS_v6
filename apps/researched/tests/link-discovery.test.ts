import { describe, expect, it } from "vitest";
import { discoverLinks } from "../src/application/link-discovery.js";
describe("controlled link discovery", () => {
  const html = `<a href="/one#section">One</a><a href="/one">Duplicate</a><a href="https://example.org/two">Two</a><a href="https://external.test/out">External</a><a href="mailto:a@example.org">Mail</a>`;
  it("defaults to bounded same-origin discovery with canonical deduplication", () => {
    expect(discoverLinks(html, "https://example.org/root")).toEqual([
      { url: "https://example.org/one", text: "One" },
      { url: "https://example.org/two", text: "Two" },
    ]);
  });
  it("only includes external links when explicitly enabled", () => {
    const result = discoverLinks(html, "https://example.org/root", {
      sameOrigin: false,
      maximum: 3,
    });
    expect(result).toHaveLength(3);
    expect(result[2]?.url).toBe("https://external.test/out");
  });
});
