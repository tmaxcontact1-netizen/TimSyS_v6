import { mergeConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import base from "./vitest.config.js";
export default mergeConfig(base, {
  resolve: { alias: { "@timsys/app-sdk": fileURLToPath(new URL("../../platform/packages/app-sdk/index.js", import.meta.url)) } },
});
