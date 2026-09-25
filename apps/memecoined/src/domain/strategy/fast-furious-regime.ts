import type { ShortHorizonSignal } from "./short-horizon.js";

export interface FastFuriousRegimeAssessment {
  readonly qualified: boolean;
  readonly score: number;
  readonly sampleCount: number;
  readonly emaAligned: boolean;
  readonly efficiencyRatio: number;
  readonly reason: string;
}

export function assessFastFuriousRegime(signal: ShortHorizonSignal): FastFuriousRegimeAssessment {
  const technical = signal.technical;
  const emaAligned = technical.emaFast >= technical.emaSlow;
  const enoughSamples = technical.sampleCount >= 30;
  const qualified = enoughSamples && technical.qualityScore >= 50 &&
    technical.efficiencyRatio >= .15 && emaAligned;
  return Object.freeze({
    qualified,
    score: Math.max(0, Math.min(100, Math.round(technical.qualityScore))),
    sampleCount: technical.sampleCount,
    emaAligned,
    efficiencyRatio: technical.efficiencyRatio,
    reason: !enoughSamples ? "Thirty observations are required to qualify the momentum regime"
      : technical.qualityScore < 50 ? `Momentum quality ${technical.qualityScore} is below 50`
        : technical.efficiencyRatio < .15 ? `Momentum efficiency ${technical.efficiencyRatio.toFixed(3)} is below 0.15`
          : !emaAligned ? "Fast EMA is not aligned above the slow EMA"
            : "Persistent momentum regime qualified",
  });
}
