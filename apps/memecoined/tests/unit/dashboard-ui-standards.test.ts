import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../../", import.meta.url);

describe("dashboard UI standards", () => {
  it("provides consistent application navigation and app-owned dialogs", async () => {
    const html = await readFile(new URL("frontend/index.html", root), "utf8");
    expect(html).toContain('id="app-back"');
    expect(html).toContain('id="return-launcher"');
    expect(html).toContain('id="action-dialog"');
    expect(html.indexOf('id="return-launcher"')).toBeGreaterThan(
      html.indexOf('id="sidebar-collapse"'),
    );
    const css = await readFile(new URL("frontend/styles.css", root), "utf8");
    expect(css).toContain("overflow-y: auto");
    expect(css).toContain("margin: auto 0 12px");
  });

  it("uses one numbered 50-row paginator and no browser prompt dialogs", async () => {
    const javascript = await readFile(new URL("frontend/app.js", root), "utf8");
    expect(javascript).toContain("const pageSize = 50");
    expect(javascript).toContain("function renderPagination");
    expect(javascript).toContain('number.className = "row-number"');
    expect(javascript).not.toMatch(/\bprompt\s*\(/);
    expect(javascript).not.toMatch(/\bconfirm\s*\(/);
  });

  it("presents fills as understandable trades instead of unlabeled token base units", async () => {
    const html = await readFile(new URL("frontend/index.html", root), "utf8");
    const javascript = await readFile(new URL("frontend/app.js", root), "utf8");
    expect(html).toContain(">Strategy</button>");
    expect(html).toContain("SOL value");
    expect(html).toContain('data-sort="reason"');
    expect(html).not.toContain("Token amount");
    expect(javascript).toContain('hard_stop: "Loss limit reached"');
    expect(javascript).toContain("raw token quantity");
  });

  it("shows measurable evidence across every operator page", async () => {
    const html = await readFile(new URL("frontend/index.html", root), "utf8");
    const javascript = await readFile(new URL("frontend/app.js", root), "utf8");
    for (const id of [
      "overview-assessed",
      "overview-completed",
      "overview-best-strategy",
      "performance-win-rate",
      "strategy-performance-rows",
      "closed-trade-rows",
      "pipeline-qualification-rate",
      "pipeline-buys",
      "pipeline-quote-failures",
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain("Current value");
    expect(html).toContain("Last trade");
    expect(javascript).toContain("function renderOperationalEvidence");
    expect(javascript).toContain("function renderPerformanceInsights");
    expect(javascript).toContain("qualification");
  });

  it("guards configuration edits from accidental refresh loss", async () => {
    const javascript = await readFile(new URL("frontend/app.js", root), "utf8");
    expect(javascript).toContain('window.addEventListener("beforeunload"');
    expect(javascript).toContain("configurationDirty");
    expect(javascript).toContain("configurationDraftKey");
    expect(javascript).toContain("localStorage.setItem(configurationDraftKey");
  });

  it("uses task-level pages and displays the explicit health contract", async () => {
    const html = await readFile(new URL("frontend/index.html", root), "utf8");
    const javascript = await readFile(new URL("frontend/app.js", root), "utf8");
    expect(html).toContain('id="page-title"');
    expect(html).toContain('data-pages="positions"');
    expect(html).toContain('id="database-health"');
    expect(javascript).toContain('fetch("/api/health"');
    expect(javascript).toContain("function updateNavigationState");
  });

  it("keeps dedicated pages visible regardless of Overview display preferences", async () => {
    const javascript = await readFile(new URL("frontend/app.js", root), "utf8");
    const css = await readFile(new URL("frontend/styles.css", root), "utf8");
    expect(javascript).toContain(
      'panel.hidden = page === "overview" && Boolean(id && preferences.hiddenPanels.includes(id))',
    );
    expect(javascript).toContain(
      'panel.hidden = currentPage === "overview" && preferences.hiddenPanels.includes(id)',
    );
    expect(css).toContain('body[data-density="compact"][data-page="overview"] .optional-detail');
    expect(css).not.toContain('body[data-density="compact"] .optional-detail');
  });

  it("registers every named dashboard element used by refresh rendering", async () => {
    const html = await readFile(new URL("frontend/index.html", root), "utf8");
    const javascript = await readFile(new URL("frontend/app.js", root), "utf8");
    const registry = javascript.match(/const ids = \[([\s\S]*?)\];/)?.[1] ?? "";
    const registered = new Set([...registry.matchAll(/"([^"]+)"/g)].map((match) => match[1]));
    const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
    const used = [...javascript.matchAll(/elements\["([^"]+)"\]/g)].map((match) => match[1]);

    expect([...new Set(used)].filter((id) => !registered.has(id))).toEqual([]);
    expect([...registered].filter((id) => !htmlIds.has(id))).toEqual([]);
  });
});
