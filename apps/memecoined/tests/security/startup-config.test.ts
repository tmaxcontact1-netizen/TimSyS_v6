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
  it("loads paper authority without any signing or submission capability", () => {
    const config = loadRuntimeConfig({
      ...base,
      MEMECOINED_MODE: "paper",
      SOLANA_PRIMARY_RPC_URL: "https://primary.example/rpc",
      SOLANA_FALLBACK_RPC_URL: "https://fallback.example/rpc",
      SOLANA_CLUSTER: "mainnet-beta",
      HELIUS_API_KEY: "helius-key",
      JUPITER_API_KEY: "jupiter-key",
      PAPER_TRADING_WALLET_ADDRESS: "paper-wallet",
      PAPER_INITIAL_CASH_LAMPORTS: "10000000000",
    });
    expect(config.paper).toEqual({
      heliusApiKey: "helius-key",
      jupiterApiKey: "jupiter-key",
      walletAddress: "paper-wallet",
      initialCashLamports: 10000000000n,
    });
    expect(config.execution).toBeNull();
  });
  it("requires explicit paper wallet and provider authority", () =>
    expect(() =>
      loadRuntimeConfig({
        ...base,
        MEMECOINED_MODE: "paper",
        SOLANA_PRIMARY_RPC_URL: "https://primary.example/rpc",
        SOLANA_FALLBACK_RPC_URL: "https://fallback.example/rpc",
        SOLANA_CLUSTER: "mainnet-beta",
      }),
    ).toThrow(/HELIUS_API_KEY/));
  it("rejects live signing authority in paper mode", () =>
    expect(() =>
      loadRuntimeConfig({
        ...base,
        MEMECOINED_MODE: "paper",
        SOLANA_PRIMARY_RPC_URL: "https://primary.example/rpc",
        SOLANA_FALLBACK_RPC_URL: "https://fallback.example/rpc",
        SOLANA_CLUSTER: "mainnet-beta",
        HELIUS_API_KEY: "helius-key",
        JUPITER_API_KEY: "jupiter-key",
        PAPER_TRADING_WALLET_ADDRESS: "paper-wallet",
        PAPER_INITIAL_CASH_LAMPORTS: "10000000000",
        TRADING_WALLET_SECRET_FILE: "/run/secrets/wallet.json",
      }),
    ).toThrow(/forbids signer secrets/));
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
