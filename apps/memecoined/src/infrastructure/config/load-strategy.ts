import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { z } from "zod";

const legacyStrategySchema = z.object({
  version: z.string().regex(/^strategy-v\d+\.\d+\.\d+$/),
  name: z.string().trim().min(1),
  status: z.literal("legacy_shared_baseline"),
  profileCatalogue: z.string().regex(/^profiles-v\d+\.\d+\.\d+$/),
  candidateScoreMinimum: z.number().int().min(1).max(95),
  absoluteSecurityGates: z.literal(true),
  notes: z.string().trim().min(1),
});

export type LegacyStrategyConfiguration = Readonly<z.infer<typeof legacyStrategySchema>>;

/** Loads the common safety baseline. Profile behaviour is defined by the versioned catalogue. */
export async function loadLegacyStrategyConfiguration(
  configurationDirectory: string,
): Promise<LegacyStrategyConfiguration> {
  const parsed = legacyStrategySchema.safeParse(
    JSON.parse(await readFile(resolve(configurationDirectory, "strategy-v1.json"), "utf8")),
  );
  if (!parsed.success)
    throw new Error(`Invalid strategy configuration: ${z.prettifyError(parsed.error)}`);
  return Object.freeze(parsed.data);
}
