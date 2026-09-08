import { describe, expect, it } from "vitest";
import { platformContracts } from "../../src/application/contracts/platform.js";
import { createStateMachine } from "../../src/domain/shared/state-machine.js";

describe("TimSyS platform bridge", () => {
  it("declares the shared protocol and executes lifecycle logic through the platform SDK", () => {
    expect(platformContracts.protocol).toBe("timsys.application.v1");
    const machine = createStateMachine<"open" | "closed">({ open: ["closed"], closed: [] });
    expect(machine.transition("open", "closed")).toBe("closed");
    expect(() => machine.transition("closed", "open")).toThrow("Invalid state transition");
  });
});
