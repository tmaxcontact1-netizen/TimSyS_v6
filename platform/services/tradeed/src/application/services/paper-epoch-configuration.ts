import { createHash } from "node:crypto";

import type { Pool } from "pg";

import type { RuntimeConfig } from "../../infrastructure/config/load-config.js";
import { profileIds, tradingProfile } from "../../domain/strategy/profiles.js";
import { observationRuntimePolicy } from "../../domain/strategy/observation-runtime.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function profilePolicy() {
  return profileIds.map((id) => tradingProfile(id));
}

/** Seals the active epoch to the exact paper policy and provider configuration. */
export async function assertPaperEpochConfiguration(
  pool: Pick<Pool, "query">,
  config: RuntimeConfig,
): Promise<string> {
  if (config.mode !== "paper" || config.paper === null || config.solana === null)
    throw new Error("A paper epoch can only be sealed by complete paper configuration");
  const activations = await pool.query<{
    readonly profile_id: string;
    readonly enabled: boolean;
    readonly allocation_bps: number;
    readonly mode: string;
  }>(
    `SELECT profile_id,enabled,allocation_bps,mode FROM paper_profile_activations
      WHERE wallet=$1 ORDER BY profile_id`,
    [config.paper.walletAddress],
  );
  const material = JSON.stringify({
    protocol: "independent-observation-v1",
    runtime: observationRuntimePolicy,
    profiles: profilePolicy(),
    activations: activations.rows,
    providers: {
      cluster: config.solana.cluster,
      primaryRpc: sha256(config.solana.primaryRpcUrl),
      fallbackRpc: sha256(config.solana.fallbackRpcUrl),
      heliusAuthority: sha256(config.paper.heliusApiKey),
      jupiterAuthority: sha256(config.paper.jupiterApiKey),
      coingeckoAuthority:
        config.paper.coingeckoDemoApiKey === null
          ? null
          : sha256(config.paper.coingeckoDemoApiKey),
    },
    account: {
      wallet: config.paper.walletAddress,
      initialCashLamports: config.paper.initialCashLamports.toString(),
      executionFeeLamports: config.paper.executionFeeLamports.toString(),
    },
  });
  const expected = sha256(material);
  const result = await pool.query<{ readonly config_hash: string }>(
    `UPDATE paper_validation_epochs SET config_hash=$1
      WHERE id=current_paper_validation_epoch_id() AND config_hash IS NULL
     RETURNING config_hash`,
    [expected],
  );
  const stored =
    result.rows[0]?.config_hash ??
    (
      await pool.query<{ readonly config_hash: string }>(
        `SELECT config_hash FROM paper_validation_epochs
          WHERE id=current_paper_validation_epoch_id()`,
      )
    ).rows[0]?.config_hash;
  if (stored === undefined) throw new Error("No active paper validation epoch exists");
  if (stored !== expected)
    throw new Error(
      "Paper validation configuration changed after the epoch began; create a fresh epoch before continuing",
    );
  return expected;
}
