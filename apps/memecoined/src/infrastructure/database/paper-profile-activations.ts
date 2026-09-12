import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

import type { WalletAddress } from "../../domain/shared/types.js";
import {
  tradingProfileCatalogue,
  validateConcurrentProfileAllocation,
  type PaperProfileMode,
  type TradingProfileId,
} from "../../domain/strategy/profiles.js";

export interface PaperProfileActivation {
  readonly profileId: TradingProfileId;
  readonly enabled: boolean;
  readonly mode: PaperProfileMode;
  readonly allocationBps: number;
  readonly version: number;
  readonly updatedAt: string | null;
}

interface ActivationRow {
  readonly profile_id: TradingProfileId;
  readonly enabled: boolean;
  readonly mode: PaperProfileMode;
  readonly allocation_bps: number;
  readonly version: string | number;
  readonly updated_at: Date | string;
}

export class ProfileActivationConflictError extends Error {}

const defaults = new Map(
  tradingProfileCatalogue.map((profile) => [profile.id, profile.defaultAllocationBps]),
);

function activation(row: ActivationRow): PaperProfileActivation {
  return Object.freeze({
    profileId: row.profile_id,
    enabled: row.enabled,
    mode: row.mode,
    allocationBps: row.allocation_bps,
    version: Number(row.version),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : new Date(row.updated_at).toISOString(),
  });
}

export async function listPaperProfileActivations(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
): Promise<readonly PaperProfileActivation[]> {
  const result = await database.query<ActivationRow>(
    `SELECT profile_id,enabled,mode,allocation_bps,version,updated_at
     FROM paper_profile_activations WHERE wallet=$1 ORDER BY profile_id`,
    [wallet],
  );
  const stored = new Map(result.rows.map((row) => [row.profile_id, activation(row)]));
  return Object.freeze(
    tradingProfileCatalogue.map(
      (profile) =>
        stored.get(profile.id) ??
        Object.freeze({
          profileId: profile.id,
          enabled: false,
          mode: "observe" as const,
          allocationBps: defaults.get(profile.id) ?? 0,
          version: 0,
          updatedAt: null,
        }),
    ),
  );
}

export async function configurePaperProfile(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
  profileId: TradingProfileId,
  expectedVersion: number,
  enabled: boolean,
  mode: PaperProfileMode,
  allocationBps: number,
  occurredAt: Date,
): Promise<PaperProfileActivation> {
  const current = await listPaperProfileActivations(database, wallet);
  const selected = current.find((item) => item.profileId === profileId);
  if (selected === undefined || selected.version !== expectedVersion)
    throw new ProfileActivationConflictError("Trading profile changed; reload before trying again");
  validateConcurrentProfileAllocation(
    current.map((item) =>
      item.profileId === profileId ? { profileId, enabled, mode, allocationBps } : item,
    ),
  );
  const action = !selected.enabled && enabled
    ? "profile_enabled"
    : selected.enabled && !enabled
      ? "profile_disabled"
      : "profile_configured";
  const result = await database.query<ActivationRow>(
    `WITH changed AS (
       INSERT INTO paper_profile_activations
         (wallet,profile_id,enabled,mode,allocation_bps,version,created_at,updated_at)
       SELECT $1,$2,$3,$4,$5,1,$7,$7 WHERE $6=0
       ON CONFLICT (wallet,profile_id) DO UPDATE SET
         enabled=EXCLUDED.enabled,mode=EXCLUDED.mode,allocation_bps=EXCLUDED.allocation_bps,
         version=paper_profile_activations.version+1,updated_at=EXCLUDED.updated_at
       WHERE paper_profile_activations.version=$6
       RETURNING *
     ), audited AS (
       INSERT INTO paper_profile_activation_audit
         (id,wallet,profile_id,action,expected_version,resulting_version,payload_json,occurred_at)
       SELECT $8,$1,profile_id,$9,$6,version,
              jsonb_build_object('enabled',enabled,'mode',mode,'allocationBps',allocation_bps),$7
       FROM changed
     ) SELECT profile_id,enabled,mode,allocation_bps,version,updated_at FROM changed`,
    [wallet, profileId, enabled, mode, allocationBps, expectedVersion, occurredAt, randomUUID(), action],
  );
  const row = result.rows[0];
  if (row === undefined)
    throw new ProfileActivationConflictError("Trading profile changed; reload before trying again");
  return activation(row);
}
