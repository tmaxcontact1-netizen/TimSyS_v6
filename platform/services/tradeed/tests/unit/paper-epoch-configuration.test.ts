import { describe, expect, test } from "vitest";

import { assertPaperEpochConfiguration } from "../../src/application/services/paper-epoch-configuration.js";
import type { RuntimeConfig } from "../../src/infrastructure/config/load-config.js";

function config(fee = 5_000n): RuntimeConfig {
  return {
    environment: "production",
    mode: "paper",
    instanceId: "test",
    logLevel: "warn",
    configDirectory: "config",
    databaseUrl: "postgresql://unused",
    managedDatabase: true,
    solana: {
      primaryRpcUrl: "https://primary.invalid",
      fallbackRpcUrl: "https://fallback.invalid",
      cluster: "mainnet-beta",
    },
    paper: {
      heliusApiKey: "helius",
      jupiterApiKey: "jupiter",
      coingeckoDemoApiKey: "coingecko",
      walletAddress: "wallet",
      initialCashLamports: 10_000_000_000n,
      executionFeeLamports: fee,
      trialPreset: null,
    },
    execution: null,
    liveTrial: null,
    telegram: null,
  };
}

describe("paper epoch configuration seal", () => {
  test("stores the first hash and fails loudly when any frozen setting changes", async () => {
    let stored: string | undefined;
    const pool = {
      query: async (sql: string, values?: readonly unknown[]) => {
        if (sql.includes("FROM paper_profile_activations"))
          return {
            rows: [
              {
                profile_id: "fast_furious",
                enabled: true,
                allocation_bps: 10_000,
                mode: "automatic_paper",
              },
            ],
            rowCount: 1,
          };
        if (sql.startsWith("UPDATE paper_validation_epochs")) {
          if (stored === undefined) {
            stored = String(values?.[0]);
            return { rows: [{ config_hash: stored }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }
        return { rows: [{ config_hash: stored }], rowCount: 1 };
      },
    };
    const sealed = await assertPaperEpochConfiguration(pool as never, config());
    expect(sealed).toBe(stored);
    await expect(assertPaperEpochConfiguration(pool as never, config(9_000n))).rejects.toThrow(
      /configuration changed/i,
    );
  });
});
