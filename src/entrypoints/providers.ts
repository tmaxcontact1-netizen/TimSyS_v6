import type {
  ChainObservationPort,
  ChainTransactionObservationPort,
} from "../application/ports/chain.js";
import type { MarketObservationPort } from "../application/ports/market.js";
import type { ExecutionAuthorityPort } from "../application/ports/runtime.js";
import type { LocalSignerPort, TransactionSubmissionPort } from "../application/ports/signer.js";
import type { SwapPort } from "../application/ports/swap.js";
import type { RuntimeConfig } from "../infrastructure/config/load-config.js";
import { DexScreenerMarketAdapter } from "../infrastructure/providers/dexscreener/adapter.js";
import { HeliusSenderHttpTransport } from "../infrastructure/providers/helius/client.js";
import { HeliusSubmissionAdapter } from "../infrastructure/providers/helius/submission-adapter.js";
import { BoundedJsonHttpTransport } from "../infrastructure/providers/http-json.js";
import { JupiterSwapAdapter } from "../infrastructure/providers/jupiter/adapter.js";
import { JupiterSwapApiClient } from "../infrastructure/providers/jupiter/client.js";
import { SolanaChainObservationAdapter } from "../infrastructure/providers/solana/chain-adapter.js";
import {
  SolanaExecutionRpc,
  SolanaRpcClient,
  SolanaRpcHttpTransport,
} from "../infrastructure/providers/solana/rpc-client.js";
import { SolanaTransactionObservationAdapter } from "../infrastructure/providers/solana/transaction-parser.js";
import { LocalTransactionSigner } from "../infrastructure/security/local-signer.js";
import { RestrictedWalletSecretFile } from "../infrastructure/security/secret-provider.js";
import { DeterministicEvidenceIdentityFactory } from "../infrastructure/runtime/evidence-id.js";

export interface ProductionProviderServices {
  readonly market: MarketObservationPort;
  readonly balances: ChainObservationPort;
  readonly transactions: ChainTransactionObservationPort;
  readonly swap: SwapPort;
  readonly signer: LocalSignerPort;
  readonly submission: TransactionSubmissionPort;
  readonly authority: ExecutionAuthorityPort;
}

/** Constructs all completed live provider clients from validated configuration. */
export function composeProductionProviders(config: RuntimeConfig): ProductionProviderServices {
  if (config.solana === null || config.execution === null)
    throw new Error("Production providers require an execution-enabled configuration");
  const primaryUrl = new URL(config.solana.primaryRpcUrl);
  const fallbackUrl = new URL(config.solana.fallbackRpcUrl);
  const rpcHttp = new BoundedJsonHttpTransport({
    allowedOrigins: new Set([primaryUrl.origin, fallbackUrl.origin]),
  });
  const primary = new SolanaRpcClient(
    new SolanaRpcHttpTransport(rpcHttp, config.solana.primaryRpcUrl),
  );
  const fallback = new SolanaRpcClient(
    new SolanaRpcHttpTransport(rpcHttp, config.solana.fallbackRpcUrl),
  );
  const identities = new DeterministicEvidenceIdentityFactory();
  const publicHttp = new BoundedJsonHttpTransport({
    allowedOrigins: new Set(["https://api.dexscreener.com", "https://api.jup.ag"]),
  });
  const senderHttp = new BoundedJsonHttpTransport({
    allowedOrigins: new Set(["https://sender.helius-rpc.com"]),
  });
  const authority = new SolanaExecutionRpc(primary);
  return Object.freeze({
    market: new DexScreenerMarketAdapter(publicHttp, identities),
    balances: new SolanaChainObservationAdapter(primary, fallback, identities),
    transactions: new SolanaTransactionObservationAdapter(primary, fallback, identities),
    swap: new JupiterSwapAdapter(
      new JupiterSwapApiClient(publicHttp, config.execution.jupiterApiKey),
      authority,
      identities,
    ),
    signer: new LocalTransactionSigner(
      new RestrictedWalletSecretFile(config.execution.walletSecretFile),
    ),
    submission: new HeliusSubmissionAdapter(
      new HeliusSenderHttpTransport(senderHttp, config.execution.heliusApiKey),
    ),
    authority,
  });
}
