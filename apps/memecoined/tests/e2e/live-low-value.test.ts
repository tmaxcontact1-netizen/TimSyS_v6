import { describe, expect, it } from "vitest";
import { authorizeLowValueTrial } from "../../src/infrastructure/runtime/low-value-trial-gate.js";
const approved = {
  MEMECOINED_MODE: "supervised_live",
  MEMECOINED_LOW_VALUE_TRIAL: "I_ACCEPT_LOW_VALUE_MAINNET_RISK",
  MEMECOINED_TRIAL_APPROVAL_ID: "trial-2026-08-26-operator",
  MEMECOINED_TRIAL_MAX_LAMPORTS: "1000000",
  MEMECOINED_TRIAL_WALLET: "11111111111111111111111111111111",
};
describe("manual low-value mainnet harness gate", () => {
  it("is disabled under the normal test and production environments", () => {
    expect(() => authorizeLowValueTrial({})).toThrow("not explicitly authorized");
    expect(() => authorizeLowValueTrial({ ...approved, CI: "true" })).toThrow("prohibited in CI");
  });
  it("enforces a non-configurable 0.01 SOL ceiling", () => {
    expect(() =>
      authorizeLowValueTrial({ ...approved, MEMECOINED_TRIAL_MAX_LAMPORTS: "10000001" }),
    ).toThrow("ceiling");
  });
  it("returns bounded authorization data but no signing or submission authority", () => {
    const result = authorizeLowValueTrial(approved);
    expect(result).toEqual({
      approvalId: "trial-2026-08-26-operator",
      maximumLamports: 1000000n,
      wallet: "11111111111111111111111111111111",
    });
    expect(result).not.toHaveProperty("signer");
  });
});
