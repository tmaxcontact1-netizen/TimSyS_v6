import { Decimal } from "decimal.js";
import type { QueryResult } from "pg";

import type { WalletInventoryObservationPort } from "../../application/ports/chain.js";
import type { ObservationTrace } from "../../application/contracts/observations.js";
import type { OpenPositionInventoryFactSource } from "../../application/services/open-position-executable-valuation.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { EvidenceReference } from "../../domain/shared/evidence.js";
import {
  asNonNegativeDecimal,
  asUuid,
  type EvidenceId,
  type MintAddress,
  type Timestamp,
  type WalletAddress,
} from "../../domain/shared/types.js";
import { positionCheckpointFromRow, type PositionCheckpointRow } from "./repositories.js";

interface DatabasePort {
  query<Row extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

interface InventoryRow extends PositionCheckpointRow {
  readonly wallet: string;
  readonly token_mint: string;
  readonly settlement_mint: string;
}

interface ReservationRow extends Record<string, unknown> {
  readonly reserved_sol: string;
}

function traceEvidence(trace: ObservationTrace): EvidenceReference {
  return Object.freeze({
    id: trace.evidenceId,
    provider: trace.provider,
    observedAt: trace.normalizedAt,
    sourceKey: trace.sourceKey,
    ...(trace.slot === undefined ? {} : { slot: trace.slot }),
    contentHash: trace.contentHash,
  });
}

/** Reconstructs open positions and active entry reservations, joined to agreed native liquidity. */
export class PostgresOpenPositionInventorySource implements OpenPositionInventoryFactSource {
  public constructor(
    private readonly database: DatabasePort,
    private readonly chain: WalletInventoryObservationPort,
    private readonly wallet: WalletAddress,
  ) {}

  public async observeInventory(requestedAt: Timestamp) {
    const [rows, reservations, walletInventory] = await Promise.all([
      this.database.query<InventoryRow>(
        `SELECT jobs.id, jobs.version, jobs.payload_json, contexts.wallet,
                contexts.token_mint, contexts.settlement_mint
         FROM jobs
         JOIN position_runtime_contexts AS contexts ON contexts.position_id=jobs.id
         WHERE jobs.job_type='position_runtime' AND contexts.wallet=$1
         ORDER BY jobs.id`,
        [this.wallet],
      ),
      this.database.query<ReservationRow>(
        `SELECT COALESCE(sum(position_size_sol),0)::text AS reserved_sol
         FROM entry_plans
         LEFT JOIN orders USING (signal_id)
         WHERE entry_plans.state='planned'
            OR (orders.wallet_address=$1 AND entry_plans.state IN ('quoting','submitted'))`,
        [this.wallet],
      ),
      this.chain.observeWalletInventory(this.wallet, requestedAt),
    ]);
    if (!walletInventory.ok)
      throw new InvariantViolationError(
        `Native liquidity unavailable: ${walletInventory.error.code}: ${walletInventory.error.reason}`,
      );
    if (walletInventory.value.wallet !== this.wallet)
      throw new InvariantViolationError("Wallet inventory targets another wallet");
    if (reservations.rowCount !== 1 || reservations.rows[0] === undefined)
      throw new InvariantViolationError("Entry reservation authority is unavailable");

    const evidence = walletInventory.value.traces.map(traceEvidence);
    const positions = rows.rows.flatMap((row) => {
      if (row.wallet !== this.wallet)
        throw new InvariantViolationError("Position inventory contains another wallet");
      const checkpoint = positionCheckpointFromRow(row);
      const position = checkpoint.runtimeState.lifecycle.position;
      if (position === null || position.state === "closed") return [];
      const lastEvent = checkpoint.runtimeState.lifecycle.appliedEvents.at(-1);
      if (lastEvent === undefined)
        throw new InvariantViolationError("Open position lacks durable lifecycle evidence");
      return [
        Object.freeze({
          positionId: position.id,
          tokenMint: row.token_mint as MintAddress,
          settlementMint: row.settlement_mint as MintAddress,
          currentAmount: position.currentAmount,
          remainingCostBasisSol: position.remainingCostBasisSol,
          evidence: Object.freeze([
            {
              id: asUuid<EvidenceId>(lastEvent.eventId),
              provider: "solana_rpc" as const,
              observedAt: position.updatedAt,
              sourceKey: `position-checkpoint:${position.id}:${checkpoint.revision.toString()}`,
            },
          ]),
        }),
      ];
    });
    const reservedEntryCostSol = asNonNegativeDecimal(reservations.rows[0].reserved_sol);
    const nativeBalanceSol = asNonNegativeDecimal(
      new Decimal(walletInventory.value.nativeBalanceLamports.toString()).div(1_000_000_000),
    );
    if (reservedEntryCostSol.gt(nativeBalanceSol))
      throw new InvariantViolationError("Active entry reservations exceed native liquidity");
    return Object.freeze({
      wallet: this.wallet,
      observedAt: requestedAt,
      liquidNativeSol: nativeBalanceSol,
      reservedEntryCostSol,
      usesLeverageOrBorrowing: false,
      positions: Object.freeze(positions),
      evidence: Object.freeze(evidence),
    });
  }
}
