import { describe, expect, it } from "vitest";
import { loadRuntimeConfig } from "../../src/infrastructure/config/load-config.js";

const base = {
  MEMECOINED_ENV: "test",
  MEMECOINED_MODE: "historical",
  MEMECOINED_INSTANCE_ID: "test-1",
  MEMECOINED_LOG_LEVEL: "info",
  MEMECOINED_CONFIG_DIR: "/etc/memecoined",
  DATABASE_URL: "postgresql://user:pass@localhost/db",
};

describe("runtime configuration", () => {
  it("loads historical mode without live credentials", () =>
    expect(loadRuntimeConfig(base)).toMatchObject({
      mode: "historical",
      solana: null,
      execution: null,
    }));
  it("requires independent RPC providers for observation", () =>
    expect(() =>
      loadRuntimeConfig({
        ...base,
        MEMECOINED_MODE: "observation",
        SOLANA_PRIMARY_RPC_URL: "https://rpc.example/a",
        SOLANA_FALLBACK_RPC_URL: "https://rpc.example/b",
        SOLANA_CLUSTER: "mainnet-beta",
      }),
    ).toThrow(/independent/));
  it("loads read-only live mode without signer secrets", () =>
    expect(
      loadRuntimeConfig({
        ...base,
        MEMECOINED_MODE: "shadow",
        SOLANA_PRIMARY_RPC_URL: "https://primary.example/rpc",
        SOLANA_FALLBACK_RPC_URL: "https://fallback.example/rpc",
        SOLANA_CLUSTER: "mainnet-beta",
      }).execution,
    ).toBeNull());
  it("requires all execution credentials for live execution", () =>
    expect(() =>
      loadRuntimeConfig({
        ...base,
        MEMECOINED_MODE: "supervised_live",
        SOLANA_PRIMARY_RPC_URL: "https://primary.example/rpc",
        SOLANA_FALLBACK_RPC_URL: "https://fallback.example/rpc",
        SOLANA_CLUSTER: "mainnet-beta",
      }),
    ).toThrow(/HELIUS_API_KEY/));
  it("loads explicit transaction authority policy for execution", () => {
    const config = loadRuntimeConfig({
      ...base,
      MEMECOINED_MODE: "supervised_live",
      SOLANA_PRIMARY_RPC_URL: "https://primary.example/rpc",
      SOLANA_FALLBACK_RPC_URL: "https://fallback.example/rpc",
      SOLANA_CLUSTER: "mainnet-beta",
      HELIUS_API_KEY: "helius-key",
      JUPITER_API_KEY: "jupiter-key",
      TRADING_WALLET_SECRET_FILE: "/run/secrets/wallet.json",
      TRANSACTION_ALLOWED_PROGRAM_IDS: "program-a,program-b",
      TRANSACTION_ALLOWED_FEE_RECIPIENTS: "fee-a",
      TRANSACTION_ALLOWED_DESTINATIONS: "destination-a",
      TRANSACTION_MAX_PRIORITY_FEE_LAMPORTS: "500000",
    });
    expect(config.execution?.allowedProgramIds).toEqual(new Set(["program-a", "program-b"]));
    expect(config.execution?.maximumPrioritizationFeeLamports).toBe(500_000n);
  });
  it("never includes unrelated environment secrets", () =>
    expect(loadRuntimeConfig({ ...base, UNRELATED_SECRET: "do-not-copy" })).not.toHaveProperty(
      "UNRELATED_SECRET",
    ));
  it("rejects loopback production databases", () =>
    expect(() => loadRuntimeConfig({ ...base, MEMECOINED_ENV: "production" })).toThrow(/loopback/));
});
