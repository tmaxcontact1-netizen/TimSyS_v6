import type { MintAddress, Timestamp, WalletAddress } from "../../domain/shared/types.js";
import { WRAPPED_SOL_MINT } from "./portfolio-inventory-valuation.js";

export interface PaperAccountInitializer {
  openAccount(input: {
    wallet: WalletAddress;
    settlementMint: MintAddress;
    initialCashRaw: bigint;
    openedAt: Timestamp;
  }): Promise<void>;
}

export async function initializePaperAccount(input: {
  readonly wallet: WalletAddress;
  readonly initialCashLamports: bigint;
  readonly initializedAt: Timestamp;
  readonly ledger: PaperAccountInitializer;
}): Promise<void> {
  if (input.initialCashLamports <= 0n) throw new Error("Paper initial cash must be positive");
  await input.ledger.openAccount({
    wallet: input.wallet,
    settlementMint: WRAPPED_SOL_MINT,
    initialCashRaw: input.initialCashLamports,
    openedAt: input.initializedAt,
  });
}
