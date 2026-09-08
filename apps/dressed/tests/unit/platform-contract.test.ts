import { describe, expect, test } from "vitest";
import { platformContracts } from "../../src/application/contracts/platform.js";
import { createStateMachine } from "../../src/domain/shared/state-machine.js";

describe("TimSyS platform bridge", () => {
  test("declares the shared protocol and executes lifecycle logic through the platform SDK", () => {
    expect(platformContracts.protocol).toBe("timsys.application.v1");
    const machine = createStateMachine<"ready" | "used">({ ready: ["used"], used: [] });
    expect(machine.transition("ready", "used")).toBe("used");
    expect(() => machine.transition("used", "ready")).toThrow("Invalid state transition");
  });
});
