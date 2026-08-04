import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/unit/token-security.test.ts",
      "tests/unit/momentum.test.ts",
      "tests/unit/position-sizing.test.ts",
      "tests/unit/quote.test.ts",
    ],
    passWithNoTests: false,
  },
});
