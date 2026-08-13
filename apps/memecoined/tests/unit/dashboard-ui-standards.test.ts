import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../../", import.meta.url);

describe("dashboard UI standards", () => {
  it("provides consistent application navigation and app-owned dialogs", async () => {
    const html = await readFile(new URL("frontend/index.html", root), "utf8");
    expect(html).toContain('id="app-back"');
    expect(html).toContain('id="return-launcher"');
    expect(html).toContain('id="action-dialog"');
  });

  it("uses one numbered 50-row paginator and no browser prompt dialogs", async () => {
    const javascript = await readFile(new URL("frontend/app.js", root), "utf8");
    expect(javascript).toContain("const pageSize = 50");
    expect(javascript).toContain("function renderPagination");
    expect(javascript).toContain('number.className = "row-number"');
    expect(javascript).not.toMatch(/\bprompt\s*\(/);
    expect(javascript).not.toMatch(/\bconfirm\s*\(/);
  });

  it("guards configuration edits from accidental refresh loss", async () => {
    const javascript = await readFile(new URL("frontend/app.js", root), "utf8");
    expect(javascript).toContain('window.addEventListener("beforeunload"');
    expect(javascript).toContain("configurationDirty");
  });
});
