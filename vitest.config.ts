import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/unit/token-security.test.ts",
      "tests/unit/momentum.test.ts",
      "tests/unit/position-sizing.test.ts",
      "tests/unit/quote.test.ts",
      "tests/unit/order-state.test.ts",
      "tests/unit/position-exits.test.ts",
      "tests/unit/emergency-exits.test.ts",
      "tests/unit/emergency-execution.test.ts",
      "tests/unit/standard-execution.test.ts",
      "tests/integration/execution.test.ts",
      "tests/integration/position-worker.test.ts",
      "tests/integration/persistence.test.ts",
      "tests/integration/restart-recovery.test.ts",
      "tests/contract/dexscreener.test.ts",
      "tests/contract/solana.test.ts",
      "tests/contract/jupiter.test.ts",
      "tests/contract/helius.test.ts",
      "tests/security/transaction-inspection.test.ts",
      "tests/failure/reconciliation.test.ts",
      "tests/replay/determinism.test.ts",
    ],
    passWithNoTests: false,
  },
});
