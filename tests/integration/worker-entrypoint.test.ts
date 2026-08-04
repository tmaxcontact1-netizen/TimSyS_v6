import { describe, expect, it, vi } from "vitest";

import { startProductionWorker } from "../../src/entrypoints/worker.js";

const environment = {
  MEMECOINED_ENV: "test",
  MEMECOINED_MODE: "supervised_live",
  MEMECOINED_INSTANCE_ID: "worker-test",
  MEMECOINED_LOG_LEVEL: "fatal",
  MEMECOINED_CONFIG_DIR: "/etc/memecoined",
  DATABASE_URL: "postgresql://user:pass@localhost/db",
  SOLANA_PRIMARY_RPC_URL: "https://primary.example/rpc",
  SOLANA_FALLBACK_RPC_URL: "https://fallback.example/rpc",
  SOLANA_CLUSTER: "mainnet-beta",
  HELIUS_API_KEY: "helius-key",
  JUPITER_API_KEY: "jupiter-key",
  TRADING_WALLET_SECRET_FILE: "/run/secrets/wallet.json",
  TRANSACTION_ALLOWED_PROGRAM_IDS: "program-a",
  TRANSACTION_ALLOWED_FEE_RECIPIENTS: "fee-a",
  TRANSACTION_ALLOWED_DESTINATIONS: "destination-a",
  TRANSACTION_MAX_PRIORITY_FEE_LAMPORTS: "500000",
};

describe("production worker entrypoint", () => {
  it("hands the composed supervisor to the validated process runner", async () => {
    const database = { end: vi.fn() };
    const supervisor = { signal: new AbortController().signal };
    const run = vi.fn(async () => ({ started: true }));
    await expect(
      startProductionWorker(environment, {
        createPool: () => database as never,
        compose: () => ({ checkpoints: {}, supervisor }) as never,
        run: run as never,
      }),
    ).resolves.toEqual({ started: true });
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ database, supervisor }));
    expect(database.end).not.toHaveBeenCalled();
  });

  it("closes the pool when composition fails before process ownership transfers", async () => {
    const database = { end: vi.fn(async () => undefined) };
    await expect(
      startProductionWorker(environment, {
        createPool: () => database as never,
        compose: () => {
          throw new Error("composition failed");
        },
        run: vi.fn() as never,
      }),
    ).rejects.toThrow(/composition failed/);
    expect(database.end).toHaveBeenCalledOnce();
  });
});
