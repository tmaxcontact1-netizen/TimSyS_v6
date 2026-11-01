import { describe, expect, it } from "vitest";
import { parse, resolve } from "node:path";

import { resolveApplicationRoot } from "../../src/infrastructure/runtime/application-root.js";

describe("application root", () => {
  it("uses the explicit TimSyS-managed installation root", () => {
    const managedRoot = resolve(parse(process.cwd()).root, "opt", "timsys", "apps", "tradeed");
    expect(
      resolveApplicationRoot({ TRADEED_APP_ROOT: managedRoot }, resolve(parse(process.cwd()).root, "tmp")),
    ).toBe(managedRoot);
  });

  it("preserves standalone development from the working directory", () => {
    const workingRoot = resolve(parse(process.cwd()).root, "work", "tradeed");
    expect(resolveApplicationRoot({}, `${workingRoot}/.`)).toBe(workingRoot);
  });

  it("rejects a relative managed root", () => {
    expect(() => resolveApplicationRoot({ TRADEED_APP_ROOT: "apps/tradeed" })).toThrow(
      "TRADEED_APP_ROOT must be an absolute path",
    );
  });
});
