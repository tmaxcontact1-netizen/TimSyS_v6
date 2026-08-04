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
      "tests/replay/determinism.test.ts",
    ],
    passWithNoTests: false,
  },
});
