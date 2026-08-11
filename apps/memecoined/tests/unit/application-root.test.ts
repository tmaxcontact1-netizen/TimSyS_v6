import { describe, expect, it } from "vitest";

import { resolveApplicationRoot } from "../../src/infrastructure/runtime/application-root.js";

describe("application root", () => {
  it("uses the explicit TimSyS-managed installation root", () => {
    expect(
      resolveApplicationRoot({ MEMECOINED_APP_ROOT: "/opt/timsys/apps/memecoined" }, "/tmp"),
    ).toBe("/opt/timsys/apps/memecoined");
  });

  it("preserves standalone development from the working directory", () => {
    expect(resolveApplicationRoot({}, "/work/memecoined/.")).toBe("/work/memecoined");
  });

  it("rejects a relative managed root", () => {
    expect(() => resolveApplicationRoot({ MEMECOINED_APP_ROOT: "apps/memecoined" })).toThrow(
      "MEMECOINED_APP_ROOT must be an absolute path",
    );
  });
});
