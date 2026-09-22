import { Client } from "pg";

import { evaluateAdaptiveEntry, type AdaptiveTradeCalibration } from "../src/domain/strategy/adaptive-calibration.js";
import type { ShortHorizonSignal } from "../src/domain/strategy/short-horizon.js";
import type { TradingProfileId } from "../src/domain/strategy/profiles.js";

interface StoredSignal {
  profile_id: TradingProfileId;
  eligible: boolean;
  signal_json: ShortHorizonSignal & { adaptiveCalibration?: AdaptiveTradeCalibration };
}

const since = process.argv[2];
if (!since || !Number.isFinite(Date.parse(since)))
  throw new Error("Usage: tsx scripts/analyze-live-profile-gates.ts <ISO timestamp>");

// This audit never mutates the user's paper records. It evaluates the current
// code against facts already observed, not against invented market inputs.
const database = new Client();
await database.connect();
try {
  await database.query("BEGIN READ ONLY");
  const result = await database.query<StoredSignal>(
    `SELECT profile_id,eligible,signal_json FROM paper_fast_signal_events
      WHERE observed_at >= $1 ORDER BY observed_at`,
    [since],
  );
  const byProfile = new Map<string, {
    observed: number;
    previouslyEligible: number;
    nowAdaptiveEligible: number;
    newlyAdaptiveEligible: number;
    reasons: Map<string, number>;
  }>();
  for (const row of result.rows) {
    const counts = byProfile.get(row.profile_id) ?? {
      observed: 0, previouslyEligible: 0, nowAdaptiveEligible: 0,
      newlyAdaptiveEligible: 0, reasons: new Map<string, number>(),
    };
    counts.observed++;
    if (row.eligible) counts.previouslyEligible++;
    const calibration = row.signal_json.adaptiveCalibration ?? null;
    const decision = evaluateAdaptiveEntry(row.profile_id, row.signal_json, calibration);
    if (decision.eligible) counts.nowAdaptiveEligible++;
    if (decision.eligible && !row.eligible) counts.newlyAdaptiveEligible++;
    if (!decision.eligible) counts.reasons.set(decision.reason, (counts.reasons.get(decision.reason) ?? 0) + 1);
    byProfile.set(row.profile_id, counts);
  }
  console.log(JSON.stringify({
    source: "recorded-live-signals",
    since,
    claim: "qualification replay only; not an execution or profitability result",
    profiles: [...byProfile].map(([profileId, counts]) => ({
      profileId,
      observed: counts.observed,
      previouslyEligible: counts.previouslyEligible,
      nowAdaptiveEligible: counts.nowAdaptiveEligible,
      newlyAdaptiveEligible: counts.newlyAdaptiveEligible,
      topRejections: [...counts.reasons].sort((a, b) => b[1] - a[1]).slice(0, 5),
    })),
  }, null, 2));
  await database.query("COMMIT");
} catch (error) {
  await database.query("ROLLBACK");
  throw error;
} finally {
  await database.end();
}
