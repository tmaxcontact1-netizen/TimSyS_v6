import {resolve as resolveTestPath} from 'node:path';
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { setupFiles:[resolveTestPath(import.meta.dirname,'../../tests/helpers/domain-contract-setup.cjs')],maxWorkers:1,minWorkers:1,pool:'threads',
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});

