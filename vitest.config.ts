import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/token-security.test.ts", "tests/unit/momentum.test.ts"],
    passWithNoTests: false,
  },
});
