import { createHash } from "node:crypto";
import type { Pool } from "pg";

import type { LiveEntryPlanningWork } from "../../application/services/live-entry-preparation.js";
import {
  asUuid,
  type OrderId,
  type SignalId,
  type WalletAddress,
} from "../../domain/shared/types.js";
import { asMintAddress } from "../../domain/token/token.js";

interface Row extends Record<string, unknown> {
  readonly signal_id: string;
  readonly mint_address: string;
  readonly position_size_sol: string;
  readonly risk_run_id: string;
  readonly candidate_evaluated_at: Date | string;
}

function orderId(signalId: string): OrderId {
  const hex = createHash("sha256").update(`entry-order\0${signalId}`).digest("hex");
  return asUuid<OrderId>(
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`,
  );
}

function lamports(sol: string): bigint {
  if (!/^\d+(\.\d+)?$/.test(sol)) throw new Error("Live entry size is malformed");
  const [whole = "0", fraction = ""] = sol.split(".");
  if (fraction.length > 9 && /[1-9]/.test(fraction.slice(9)))
    throw new Error("Live entry size exceeds lamport precision");
  return BigInt(whole) * 1_000_000_000n + BigInt((fraction + "000000000").slice(0, 9));
}

export class PostgresLiveEntryPlanningSource {
  public constructor(
    private readonly database: Pick<Pool, "query">,
    private readonly wallet: WalletAddress,
    private readonly maximumInputLamports: bigint,
  ) {}

  public async nextBatch(limit = 25): Promise<readonly LiveEntryPlanningWork[]> {
    const result = await this.database.query<Row>(
      `SELECT ep.signal_id::text,ep.position_size_sol::text,ep.risk_run_id,
              c.mint_address,ce.evaluated_at AS candidate_evaluated_at
         FROM entry_plans ep
         JOIN jobs j ON j.id=ep.signal_id AND j.job_type='entry_planning'
         JOIN signals s ON s.id=ep.signal_id AND s.state='approval_pending'
         JOIN candidates c ON c.id=s.candidate_id
         JOIN candidate_evaluations ce ON ce.candidate_id=c.id AND ce.eligible=true
         JOIN risk_decisions rd ON rd.signal_id=ep.signal_id
           AND rd.risk_run_id=ep.risk_run_id AND rd.approved=true
        WHERE ep.state='planned' AND j.state='available' AND j.available_at<=now()
          AND ce.evaluated_at>=now()-interval '30 seconds'
          AND rd.evaluated_at>=now()-interval '30 seconds'
          AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.signal_id=ep.signal_id)
        ORDER BY j.available_at,ep.signal_id LIMIT $1`,
      [limit],
    );
    return Object.freeze(
      result.rows.map((row) => {
        const signalId = asUuid<SignalId>(row.signal_id);
        const inputAmountLamports = lamports(row.position_size_sol);
        if (inputAmountLamports > this.maximumInputLamports)
          throw new Error("Live entry exceeds the explicitly authorized trial ceiling");
        const candidateAt =
          row.candidate_evaluated_at instanceof Date
            ? row.candidate_evaluated_at.toISOString()
            : new Date(row.candidate_evaluated_at).toISOString();
        const eligibilityHash = createHash("sha256")
          .update([signalId, row.risk_run_id, row.position_size_sol, candidateAt].join("\0"))
          .digest("hex");
        return Object.freeze({
          signalId,
          orderId: orderId(signalId),
          mint: asMintAddress(row.mint_address),
          wallet: this.wallet,
          inputAmountLamports,
          eligibilityHash,
          securityRulesPassed: true,
          exposureRulesPassed: true,
        });
      }),
    );
  }
}
