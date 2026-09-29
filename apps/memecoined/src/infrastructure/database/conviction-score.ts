import type { Pool } from "pg";

import type { ConvictionScoreBreakdown } from "../../domain/strategy/conviction-scale.js";

export interface PersistedConvictionScore {
  readonly id: string;
  readonly signalId: string;
  readonly wallet: string;
  readonly tokenMint: string;
  readonly observedAt: string;
  readonly qualified: boolean;
  readonly score: ConvictionScoreBreakdown;
}

export async function persistConvictionScore(
  database: Pick<Pool, "query">,
  record: PersistedConvictionScore,
): Promise<void> {
  await database.query(
    `INSERT INTO paper_conviction_score_evaluations
       (id,epoch_id,signal_id,wallet,token_mint,observed_at,qualified,total_score,
        entry_depth_points,spread_points,buy_pressure_points,session_track_points,
        entry_distance_bps,spread_bps,buy_pressure,session_token_net_bps)
     VALUES($1,current_paper_validation_epoch_id(),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT(signal_id) DO NOTHING`,
    [
      record.id,
      record.signalId,
      record.wallet,
      record.tokenMint,
      record.observedAt,
      record.qualified,
      record.score.total,
      record.score.entryDepth,
      record.score.spread,
      record.score.buyPressure,
      record.score.sessionTrackRecord,
      record.score.input.entryDistanceBps,
      record.score.input.spreadBps,
      record.score.input.buyPressure,
      record.score.input.sessionTokenNetBps,
    ],
  );
}
