import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

import type { WalletAddress } from "../../domain/shared/types.js";
import {
  tradingProfileCatalogue,
  focusedProfileIdSet,
  tradingProfile,
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

/**
 * Installs the operator-requested full-workflow paper preset once. Existing profile
 * choices are authoritative and are never overwritten on a later launch.
 */
export async function ensureAllProfilesPaperTrialPreset(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
  occurredAt: Date,
): Promise<boolean> {
  const supportedProfiles = tradingProfileCatalogue.filter((profile) =>
    focusedProfileIdSet.has(profile.id),
  );
  const auditIds = supportedProfiles.map(() => randomUUID());
  const result = await database.query<{ inserted_count: string | number }>(
    `WITH presets(profile_id,enabled,mode,allocation_bps,audit_id) AS (
       VALUES
         ('fast_furious',true,'automatic_paper',5000,$3::uuid),
         ('oscillation_trader',true,'automatic_paper',5000,$4::uuid)
     ), inserted AS (
       INSERT INTO paper_profile_activations
         (wallet,profile_id,enabled,mode,allocation_bps,version,created_at,updated_at)
       SELECT $1,p.profile_id,p.enabled,p.mode,p.allocation_bps,1,$2,$2
       FROM presets p
       WHERE NOT EXISTS (SELECT 1 FROM paper_profile_activations existing WHERE existing.wallet=$1)
       ON CONFLICT (wallet,profile_id) DO NOTHING
       RETURNING profile_id,enabled,mode,allocation_bps,version
     ), audited AS (
       INSERT INTO paper_profile_activation_audit
         (id,wallet,profile_id,action,expected_version,resulting_version,payload_json,occurred_at)
       SELECT p.audit_id,$1,i.profile_id,
              CASE WHEN i.enabled THEN 'profile_enabled' ELSE 'profile_configured' END,0,i.version,
              jsonb_build_object('enabled',i.enabled,'mode',i.mode,'allocationBps',i.allocation_bps,
                                 'preset','initial_profile_catalogue'),$2
       FROM inserted i JOIN presets p USING (profile_id)
       RETURNING id
     ) SELECT count(*)::text AS inserted_count FROM inserted`,
    [wallet, occurredAt, ...auditIds],
  );
  return Number(result.rows[0]?.inserted_count ?? 0) === supportedProfiles.length;
}

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
    tradingProfileCatalogue
      .filter((profile) => focusedProfileIdSet.has(profile.id))
      .map(
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
  const definition = tradingProfile(profileId);
  if (!definition || !focusedProfileIdSet.has(profileId))
    throw new RangeError("This trading profile is no longer available");
  if (enabled && mode === "automatic_paper" && definition?.evidenceStatus === "awaiting_data")
    throw new RangeError(
      definition.evidenceMessage ?? "This profile is waiting for required evidence",
    );
  const current = await listPaperProfileActivations(database, wallet);
  const selected = current.find((item) => item.profileId === profileId);
  if (selected === undefined || selected.version !== expectedVersion)
    throw new ProfileActivationConflictError("Trading profile changed; reload before trying again");
  validateConcurrentProfileAllocation(
    current
      .filter((item) => focusedProfileIdSet.has(item.profileId))
      .map((item) =>
        item.profileId === profileId ? { profileId, enabled, mode, allocationBps } : item,
      ),
  );
  const action =
    !selected.enabled && enabled
      ? "profile_enabled"
      : selected.enabled && !enabled
        ? "profile_disabled"
        : "profile_configured";
  const result = await database.query<ActivationRow>(
    `WITH updated AS (
       UPDATE paper_profile_activations SET
         enabled=$3,mode=$4,allocation_bps=$5,version=version+1,updated_at=$7
       WHERE wallet=$1 AND profile_id=$2 AND version=$6
       RETURNING *
     ), inserted AS (
       INSERT INTO paper_profile_activations
         (wallet,profile_id,enabled,mode,allocation_bps,version,created_at,updated_at)
       SELECT $1,$2,$3,$4,$5,1,$7,$7
       WHERE $6=0 AND NOT EXISTS (
         SELECT 1 FROM paper_profile_activations WHERE wallet=$1 AND profile_id=$2
       )
       RETURNING *
     ), changed AS (
       SELECT * FROM updated UNION ALL SELECT * FROM inserted
     ), audited AS (
       INSERT INTO paper_profile_activation_audit
         (id,wallet,profile_id,action,expected_version,resulting_version,payload_json,occurred_at)
       SELECT $8,$1,profile_id,$9,$6,version,
              jsonb_build_object('enabled',enabled,'mode',mode,'allocationBps',allocation_bps),$7
       FROM changed
     ) SELECT profile_id,enabled,mode,allocation_bps,version,updated_at FROM changed`,
    [
      wallet,
      profileId,
      enabled,
      mode,
      allocationBps,
      expectedVersion,
      occurredAt,
      randomUUID(),
      action,
    ],
  );
  const row = result.rows[0];
  if (row === undefined)
    throw new ProfileActivationConflictError("Trading profile changed; reload before trying again");
  return activation(row);
}
