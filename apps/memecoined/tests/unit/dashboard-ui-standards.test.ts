import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
const root = new URL("../../", import.meta.url);
describe("focused dashboard UI standards", () => {
  it("contains only the three operator tasks and a launcher exit", async () => {
    const html = await readFile(new URL("frontend/index.html", root), "utf8");
    expect(html).toContain('data-page="dashboard"');
    expect(html).toContain('data-page="evaluations"');
    expect(html).toContain('data-page="trades"');
    expect(html).toContain('id="return-launcher"');
    expect(html).not.toContain("Watchlists");
    expect(html).not.toContain("Strategy benchmarks");
  });
  it("shows only the two supported profiles", async () => {
    const html = await readFile(new URL("frontend/index.html", root), "utf8");
    expect(html).toContain("Fast &amp; Furious");
    expect(html).toContain("Oscillation Trader");
    expect(html).not.toContain("Slow &amp; Steady");
    expect(html).not.toContain("Whale Watch");
  });
  it("exposes calibration evidence", async () => {
    const html = await readFile(new URL("frontend/index.html", root), "utf8");
    for (const id of [
      "reason-rows",
      "evaluation-rows",
      "evaluation-profile",
      "evaluation-result",
      "evaluation-search",
    ])
      expect(html).toContain(`id="${id}"`);
    expect(html).toContain("Top rejection reasons");
    expect(html).toContain("Why");
  });
  it("shows meaningful trade and performance fields", async () => {
    const html = await readFile(new URL("frontend/index.html", root), "utf8");
    expect(html).toContain('id="trade-rows"');
    expect(html).toContain("Best / worst");
    expect(html).toContain("Exit");
    expect(html).toContain("Held");
    expect(html).not.toContain("Token amount");
  });
  it("provides feedback and avoids browser dialogs", async () => {
    const javascript = await readFile(new URL("frontend/app.js", root), "utf8");
    expect(javascript).toContain("function notify");
    expect(javascript).toContain("The profile setting was not saved");
    expect(javascript).not.toMatch(/\bprompt\s*\(/);
    expect(javascript).not.toMatch(/\bconfirm\s*\(/);
  });
  it("loads real focused evidence and refreshes it", async () => {
    const javascript = await readFile(new URL("frontend/app.js", root), "utf8");
    expect(javascript).toContain('fetch("/api/focused-dashboard"');
    expect(javascript).toContain('fetch("/api/trading-profiles"');
    expect(javascript).toContain("setInterval(load, 30000)");
    expect(javascript).toContain("rejection_reasons_json");
    expect(javascript).toContain("realized_net_bps");
  });
  it("uses a restrained responsive layout", async () => {
    const css = await readFile(new URL("frontend/styles.css", root), "utf8");
    expect(css).toContain(".profile-grid");
    expect(css).toContain(".table-wrap");
    expect(css).toContain("overflow: auto");
    expect(css).toContain("@media (max-width: 900px)");
  });
});
