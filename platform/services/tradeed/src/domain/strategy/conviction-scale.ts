export interface ConvictionScoreInput {
  readonly entryDistanceBps: number;
  readonly spreadBps: number;
  readonly buyPressure: number | null;
  readonly sessionTokenNetBps: number;
}

export interface ConvictionScoreBreakdown {
  readonly total: number;
  readonly entryDepth: number;
  readonly spread: number;
  readonly buyPressure: number;
  readonly sessionTrackRecord: number;
  readonly input: ConvictionScoreInput;
}

const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const points = (weight: number, normalized: number) => Math.round(weight * clamp(normalized));

/** Fixed, auditable weights. It ranks an F&F-compatible signal; it does not alter geometry. */
export function convictionScore(input: ConvictionScoreInput): ConvictionScoreBreakdown {
  const entryDepth = points(35, (Math.abs(input.entryDistanceBps) - 20) / 80);
  const spread = points(25, 1 - input.spreadBps / 150);
  const buyPressure = points(20, ((input.buyPressure ?? 0) - 0.45) / 0.55);
  const sessionTrackRecord = points(20, (input.sessionTokenNetBps + 1_000) / 2_000);
  return Object.freeze({
    total: entryDepth + spread + buyPressure + sessionTrackRecord,
    entryDepth,
    spread,
    buyPressure,
    sessionTrackRecord,
    input: Object.freeze({ ...input }),
  });
}

export function convictionSizeMultiplierBps(score: number): number {
  return Math.round(5_000 + clamp(score / 100) * 10_000);
}

export function convictionPositionAmount(input: {
  readonly availableRaw: bigint;
  readonly baseRiskSizedRaw: bigint;
  readonly absoluteCapRaw: bigint;
  readonly score: number;
}): bigint {
  const scaled =
    (input.baseRiskSizedRaw * BigInt(convictionSizeMultiplierBps(input.score))) / 10_000n;
  return [input.availableRaw, scaled, input.absoluteCapRaw].reduce((smallest, value) =>
    value < smallest ? value : smallest,
  );
}

export const convictionMinimumScore = 60;
export const tokenSessionLossCapBps = 500;
export const consecutiveStopLockoutCount = 2;
export const consecutiveStopLockoutMinutes = 240;

export function tokenLossControl(input: {
  readonly hardStopTimes: readonly number[];
  readonly sessionNetBps: number;
  readonly now: number;
}): Readonly<{ blocked: boolean; reason: string | null }> {
  const recentStops = input.hardStopTimes.filter(
    (at) => at <= input.now && at >= input.now - consecutiveStopLockoutMinutes * 60_000,
  );
  if (recentStops.length >= consecutiveStopLockoutCount)
    return Object.freeze({
      blocked: true,
      reason: "Token had two hard-stop exits in the preceding four hours",
    });
  if (input.sessionNetBps <= -tokenSessionLossCapBps)
    return Object.freeze({
      blocked: true,
      reason: `Token reached the session loss cap of -${tokenSessionLossCapBps} bps`,
    });
  return Object.freeze({ blocked: false, reason: null });
}
