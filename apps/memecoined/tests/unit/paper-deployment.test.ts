import { expect, it, vi } from "vitest";

import { initializePaperAccount } from "../../src/application/services/paper-deployment.js";
import { asTimestamp } from "../../src/domain/shared/types.js";

it("initializes the configured paper account in wrapped SOL lamports", async () => {
  const ledger = { openAccount: vi.fn(async () => undefined) };
  await initializePaperAccount({
    wallet: "paper-wallet" as never,
    initialCashLamports: 10_000_000_000n,
    initializedAt: asTimestamp("2026-08-10T10:00:00Z"),
    ledger,
  });
  expect(ledger.openAccount).toHaveBeenCalledWith({
    wallet: "paper-wallet",
    settlementMint: "So11111111111111111111111111111111111111112",
    initialCashRaw: 10_000_000_000n,
    openedAt: "2026-08-10T10:00:00.000Z",
  });
});
