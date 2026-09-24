import type { ExecutableMarketPoint, ShortHorizonSignal } from "./short-horizon.js";
import type { TradingProfileId } from "./profiles.js";

export type VolatilityRegime = "micro" | "moderate" | "high" | "unstable" | "insufficient";
export interface AdaptiveTradeCalibration {
  readonly version: "adaptive-v2"; readonly profileId: TradingProfileId; readonly model: string;
  readonly regime: VolatilityRegime; readonly sampleCount: number; readonly confidencePercentage: number;
  readonly typicalMoveBps: number; readonly upperMoveBps: number; readonly targetBps: number;
  readonly hardStopBps: number; readonly observedDownsideBps: number; readonly trailingStopBps: number; readonly trailingActivationBps: number;
  readonly maximumHoldingMinutes: number; readonly maximumRoundTripCostBps: number;
  readonly riskSupported: boolean;
  readonly calculatedAt: string; readonly validUntil: string; readonly tradeable: boolean; readonly reason: string;
}
interface Policy {
  model: string; target: number; targetMin: number; targetMax: number; stop: number; stopMin: number; stopMax: number;
  trail: number; activate: number; holdMin: number; holdMax: number; movementMin: number;
  irregularityMax: number; friction: number; validity: number;
}
const policies: Partial<Record<TradingProfileId, Policy>> = {
  scalper: { model: "repeatable range reversal", target:.55,targetMin:60,targetMax:250,stop:.75,stopMin:55,stopMax:180,trail:.32,activate:.55,holdMin:3,holdMax:10,movementMin:45,irregularityMax:4,friction:.22,validity:5 },
  fast_furious: { model: "short momentum and pullback continuation", target:.8,targetMin:100,targetMax:500,stop:.85,stopMin:85,stopMax:350,trail:.38,activate:.6,holdMin:5,holdMax:30,movementMin:45,irregularityMax:6,friction:.3,validity:10 },
  recovery_reversal: { model: "stabilisation and rebound", target:.85,targetMin:100,targetMax:700,stop:.75,stopMin:80,stopMax:400,trail:.4,activate:.65,holdMin:10,holdMax:180,movementMin:75,irregularityMax:4.5,friction:.3,validity:15 },
  breakout_retest: { model: "breakout range and retest depth", target:1,targetMin:125,targetMax:900,stop:.8,stopMin:90,stopMax:500,trail:.4,activate:.65,holdMin:15,holdMax:180,movementMin:90,irregularityMax:5,friction:.3,validity:15 },
  trend_detector: { model: "young-token expansion and trend persistence", target:1.2,targetMin:200,targetMax:1500,stop:.9,stopMin:125,stopMax:700,trail:.42,activate:.65,holdMin:20,holdMax:360,movementMin:110,irregularityMax:5.5,friction:.3,validity:15 },
  liquidity_expansion: { model: "liquidity-supported price expansion", target:1.15,targetMin:175,targetMax:1500,stop:.85,stopMin:110,stopMax:650,trail:.42,activate:.7,holdMin:30,holdMax:360,movementMin:100,irregularityMax:5,friction:.28,validity:20 },
  launch_transition: { model: "pool-maturity and liquidity transition", target:1.3,targetMin:250,targetMax:1800,stop:.9,stopMin:150,stopMax:800,trail:.45,activate:.7,holdMin:30,holdMax:360,movementMin:125,irregularityMax:5.5,friction:.28,validity:20 },
  slow_steady: { model: "persistent trend with normal pullback tolerance", target:1.5,targetMin:300,targetMax:2500,stop:1.1,stopMin:175,stopMax:1200,trail:.5,activate:.75,holdMin:60,holdMax:720,movementMin:100,irregularityMax:4,friction:.25,validity:30 },
  capital_preservation: { model: "low-volatility trend and capital protection", target:.9,targetMin:150,targetMax:900,stop:.65,stopMin:75,stopMax:400,trail:.35,activate:.6,holdMin:30,holdMax:480,movementMin:70,irregularityMax:3.5,friction:.2,validity:30 },
  signal_consensus: { model: "multi-signal agreement within executable range", target:1.05,targetMin:175,targetMax:1200,stop:.75,stopMin:100,stopMax:550,trail:.4,activate:.65,holdMin:30,holdMax:480,movementMin:85,irregularityMax:4,friction:.25,validity:30 },
  whale_tracker: { model: "wallet impact and market follow-through", target:1.15,targetMin:200,targetMax:1500,stop:.8,stopMin:110,stopMax:650,trail:.42,activate:.7,holdMin:30,holdMax:720,movementMin:100,irregularityMax:4.5,friction:.25,validity:30 },
  social_catalyst: { model: "social lead time and market confirmation", target:1,targetMin:175,targetMax:1200,stop:.75,stopMin:100,stopMax:550,trail:.4,activate:.65,holdMin:30,holdMax:360,movementMin:90,irregularityMax:4,friction:.25,validity:20 },
};
export const isAdaptiveProfile = (id: TradingProfileId) => Boolean(policies[id]);
const clamp = (v:number,min:number,max:number) => Math.min(max,Math.max(min,Math.round(v)));
const quantile = (values:readonly number[], f:number) => {
  if (!values.length) return 0; const sorted=[...values].sort((a,b)=>a-b); const p=(sorted.length-1)*f;
  const lo=Math.floor(p), hi=Math.ceil(p); return lo===hi?sorted[lo]!:sorted[lo]!+(sorted[hi]!-sorted[lo]!)*(p-lo);
};
const moveBps=(older:bigint,newer:bigint)=>older<=0n||newer<=0n?0:Number((older*10_000n)/newer-10_000n);

/** Applies a profile-specific policy to shared executable-price history. Benchmarks deliberately remain fixed. */
export function calibrateProfile(id:TradingProfileId, points:readonly ExecutableMarketPoint[], at:string):AdaptiveTradeCalibration|null {
  const p=policies[id]; if(!p) return null;
  const recent=points.slice(-40), validUntil=new Date(Date.parse(at)+p.validity*60_000).toISOString();
  const base={version:"adaptive-v2" as const,profileId:id,model:p.model,sampleCount:recent.length,calculatedAt:at,validUntil};
  if(recent.length<10) return Object.freeze({...base,regime:"insufficient",confidencePercentage:clamp(recent.length/10*50,0,45),typicalMoveBps:0,upperMoveBps:0,targetBps:p.targetMin,hardStopBps:p.stopMin,observedDownsideBps:0,trailingStopBps:clamp(p.targetMin*p.trail,30,p.stopMax),trailingActivationBps:clamp(p.targetMin*p.activate,40,p.targetMax),maximumHoldingMinutes:p.holdMin,maximumRoundTripCostBps:clamp(p.targetMin*p.friction,20,125),riskSupported:false,tradeable:false,reason:`At least 10 executable observations are required; ${recent.length} are available`});
  const excursions:number[]=[];
  const horizons = id === "slow_steady" || id === "trend_detector" ? [4,8] : [1,2,4,8];
  for(const horizon of horizons) for(let index=horizon;index<recent.length;index+=horizon) {
    const elapsed=(Date.parse(recent[index]!.observedAt)-Date.parse(recent[index-horizon]!.observedAt))/60_000;
    if(elapsed>=horizon*.25&&elapsed<=horizon*2.5)
      excursions.push(Math.abs(moveBps(recent[index-horizon]!.outputAmountRaw,recent[index]!.outputAmountRaw)));
  }
  const meaningful=excursions.filter(v=>Number.isFinite(v)&&v>=5), typical=Math.round(quantile(meaningful,.5)), upper=Math.round(quantile(meaningful,.75));
  const irregularity=typical>0?upper/typical:Infinity, confidence=clamp(Math.min(90,50+(recent.length-10)*1.5)-Math.max(0,irregularity-3)*8,25,90);
  const discontinuous=meaningful.some((move)=>move>Math.max(2_000,upper*p.irregularityMax));
  const unstable=meaningful.length<8||irregularity>p.irregularityMax||upper>1500||discontinuous;
  const regime:VolatilityRegime=unstable?"unstable":upper<225?"micro":upper<550?"moderate":"high";
  const downside=recent.slice(1).map((point,index)=>{
    const seconds=(Date.parse(point.observedAt)-Date.parse(recent[index]!.observedAt))/1000;
    const change=moveBps(recent[index]!.outputAmountRaw,point.outputAmountRaw);
    return seconds>=15&&seconds<=120&&change<0?-change:null;
  }).filter((value):value is number=>value!==null);
  const observedDownside=Math.round(quantile(downside,.75));
  const target=clamp(upper*p.target,p.targetMin,p.targetMax);
  const requiredStop=Math.max(target*p.stop,observedDownside*1.25,typical);
  const riskSupported=requiredStop<=p.stopMax;
  const stop=clamp(requiredStop,p.stopMin,p.stopMax);
  const trailing=clamp(target*p.trail,30,Math.min(p.stopMax,target)), activation=clamp(target*p.activate,40,target);
  const intervals=recent.slice(1).map((point,index)=>Math.max(1,(Date.parse(point.observedAt)-Date.parse(recent[index]!.observedAt))/60_000)).filter(Number.isFinite);
  const steps=recent.slice(1).map((point,index)=>Math.abs(moveBps(recent[index]!.outputAmountRaw,point.outputAmountRaw))), perStep=quantile(steps,.5);
  const hold=clamp((perStep>0?target/perStep:12)*(quantile(intervals,.5)||.75)*2,p.holdMin,p.holdMax), friction=clamp(target*p.friction,20,125);
  const tradeable=!unstable&&riskSupported&&confidence>=50&&upper>=p.movementMin;
  return Object.freeze({...base,regime,confidencePercentage:confidence,typicalMoveBps:typical,upperMoveBps:upper,targetBps:target,hardStopBps:stop,observedDownsideBps:observedDownside,trailingStopBps:trailing,trailingActivationBps:activation,maximumHoldingMinutes:hold,maximumRoundTripCostBps:friction,riskSupported,tradeable,reason:tradeable?`${p.model} supports a ${target/100}% target in this token's ${regime} executable range with ${confidence}% confidence`:!riskSupported?`Required volatility stop ${Math.round(requiredStop)/100}% exceeds this profile's ${p.stopMax/100}% risk limit`:unstable?`Observed movement is too discontinuous for the ${p.model} model`:`The token's repeatable movement is below the ${p.model} opportunity threshold`});
}
export const calibrateFastFurious=(points:readonly ExecutableMarketPoint[],at:string)=>calibrateProfile("fast_furious",points,at)!;

export interface AdaptiveEntryDecision { readonly eligible: boolean; readonly reason: string; }

/** Lets the calibrated range interpret a signal without discarding each profile's distinct purpose. */
export function evaluateAdaptiveEntry(
  id: TradingProfileId,
  signal: ShortHorizonSignal,
  calibration: AdaptiveTradeCalibration | null,
): AdaptiveEntryDecision {
  if (!calibration) return Object.freeze({ eligible: signal.eligible, reason: signal.reason });
  const fastLiveOpportunity = id === "fast_furious" && calibration.sampleCount >= 10 &&
    calibration.riskSupported && signal.marketConfirmed &&
    signal.observedVolatilityBps >= Math.max(45, calibration.maximumRoundTripCostBps * 2);
  if (!calibration.tradeable && !fastLiveOpportunity)
    return Object.freeze({ eligible: false, reason: calibration.reason });
  if (!signal.marketConfirmed)
    return Object.freeze({ eligible: false, reason: "The calibrated movement is not confirmed by current market activity" });
  const buyers = signal.buyPressureBps ?? -Infinity;
  const volume = signal.volumeChangeBps ?? -Infinity;
  const liquidity = signal.liquidityChangeBps ?? -Infinity;
  const technical = signal.technical;
  const minimumCoveredBars = id === "fast_furious" ? 2 : 3;
  if (technical.recentMaxGapSeconds > 120 || technical.coveredRecentBars < minimumCoveredBars)
    return Object.freeze({ eligible: false, reason: "Executable-price observations are too sparse or uneven for a reliable entry" });
  if (id === "fast_furious") {
    const namedPattern = signal.eligible && ["momentum", "pullback_rebound"].includes(signal.pattern);
    const strictDirectionalContinuation = signal.marketConfirmed &&
      signal.cumulativeMoveBps >= Math.max(35, calibration.targetBps * .25) &&
      signal.shortMoveBps >= Math.max(12, calibration.targetBps * .08) &&
      signal.positiveSteps >= 3 && signal.drawdownFromHighBps <= calibration.hardStopBps * .35 &&
      technical.efficiencyRatio >= .30 && technical.accelerationBps >= -50 &&
      technical.bullishClose && technical.emaSlopeBps >= 0;
    if (!namedPattern && !strictDirectionalContinuation)
      return Object.freeze({ eligible: false, reason: "Fast & Furious requires a confirmed momentum or pullback-rebound pattern, or a directionally efficient continuation" });
    const flowConfirmed = (signal.buyPressureBps ?? -Infinity) >= 5_000 &&
      (signal.volumeChangeBps ?? -Infinity) >= -2_000 &&
      (signal.liquidityChangeBps ?? -Infinity) >= -500;
    if (!flowConfirmed)
      return Object.freeze({ eligible: false, reason: "Current buyers, volume and liquidity do not support a short momentum entry" });
    const moveConsumed = signal.cumulativeMoveBps > Math.max(300, calibration.targetBps * 2.5) &&
      signal.drawdownFromHighBps < calibration.trailingStopBps;
    if (moveConsumed)
      return Object.freeze({ eligible: false, reason: "The move is overextended beyond the calibrated Fast & Furious entry range" });
    const thesisConfirmed = technical.sampleCount >= 10 && technical.qualityScore >= 35 &&
      technical.emaSlopeBps >= 0 && technical.rsi >= 38 && technical.rsi <= 78 &&
      technical.efficiencyRatio >= .25 && technical.accelerationBps >= -50 &&
      technical.bullishClose && technical.historyReturnBps >= -100 &&
      technical.maximumDrawdownBps <= Math.max(800, technical.atrBps * 6);
    return Object.freeze({
      eligible: thesisConfirmed,
      reason: thesisConfirmed
        ? `${signal.reason}; ${calibration.reason}`
        : `Executable-price mathematics do not confirm a Fast & Furious entry (quality ${technical.qualityScore}/100)`,
    });
  }
  const allowedPatterns: Partial<Record<TradingProfileId, readonly ShortHorizonSignal["pattern"][]>> = {
    scalper: ["range_rebound", "pullback_rebound"],
    slow_steady: ["trend"],
    trend_detector: ["trend"],
    liquidity_expansion: ["liquidity_expansion"],
  };
  const patterns = allowedPatterns[id];
  if (patterns && (!signal.eligible || !patterns.includes(signal.pattern)))
    return Object.freeze({
      eligible: false,
      reason: `${calibration.model} requires an explicit ${patterns.join(" or ").replaceAll("_", " ")} pattern`,
    });
  const flowConfirmed = id === "scalper"
      ? buyers >= 5_250 && volume >= -250 && liquidity >= -100
      : id === "slow_steady"
        ? buyers >= 5_400 && volume >= 0 && liquidity >= 0
        : id === "trend_detector"
          ? buyers >= 5_300 && volume >= 0 && liquidity >= 0
          : true;
  if (!flowConfirmed)
    return Object.freeze({
      eligible: false,
      reason: `The price pattern is present, but current buyers, volume and liquidity do not confirm ${calibration.model}`,
    });
  if (technical.overextended)
    return Object.freeze({ eligible: false, reason: "Executable-price history is overextended; entry would chase the move" });
  if (id === "scalper" &&
      signal.cumulativeMoveBps > Math.max(150, calibration.targetBps * 1.5))
    return Object.freeze({ eligible: false, reason: "The current short move has already consumed more than the calibrated opportunity" });
  const thesisConfirmed = id === "scalper"
      ? technical.sampleCount >= 16 && technical.rsi >= 32 && technical.rsi <= 66 &&
        technical.bollingerPosition <= .65 && technical.bullishClose && technical.qualityScore >= 42 &&
        technical.historyReturnBps >= -500 && technical.maximumDrawdownBps <= Math.max(900, technical.atrBps * 6)
      : id === "slow_steady"
        ? technical.sampleCount >= 26 && technical.emaFast > technical.emaSlow && technical.emaSlopeBps > 0 &&
          technical.macdHistogramBps >= 0 && technical.rsi >= 48 && technical.rsi <= 68 &&
          technical.efficiencyRatio >= .3 && technical.qualityScore >= 62 && technical.higherLows &&
          technical.historyReturnBps > 0
        : id === "trend_detector"
          ? technical.sampleCount >= 26 && technical.emaFast > technical.emaSlow && technical.emaSlopeBps > 0 &&
            technical.macdHistogramBps > 0 && technical.accelerationBps >= 0 && technical.rsi >= 50 &&
            technical.rsi <= 74 && technical.qualityScore >= 65 && technical.efficiencyRatio >= .28 &&
            technical.higherLows && technical.historyReturnBps > 0
          : id === "liquidity_expansion"
            ? technical.sampleCount >= 20 && technical.emaFast > technical.emaSlow && technical.emaSlopeBps >= 0 &&
              technical.rsi >= 45 && technical.rsi <= 72 && technical.qualityScore >= 52 &&
              technical.efficiencyRatio >= .18 && technical.higherLows && technical.historyReturnBps >= 0 &&
              signal.liquidityPositiveSteps >= 3 && signal.volumePositiveSteps >= 3
            : id === "capital_preservation" || id === "signal_consensus" || id === "whale_tracker"
              ? technical.sampleCount >= 26 && technical.qualityScore >= 68 && technical.efficiencyRatio >= .35
              : true;
  if (!thesisConfirmed)
    return Object.freeze({
      eligible: false,
      reason: `Market flow passed, but executable-price mathematics do not confirm ${calibration.model} (quality ${technical.qualityScore}/100)`,
    });
  if (signal.eligible)
    return Object.freeze({ eligible: true, reason: `${signal.reason}; ${calibration.reason}` });

  const continuing = signal.cumulativeMoveBps >= Math.max(35, calibration.targetBps * .25) &&
    signal.shortMoveBps >= Math.max(12, calibration.targetBps * .08) &&
    signal.positiveSteps >= 3 && signal.drawdownFromHighBps <= calibration.hardStopBps * .35;
  const immediate = signal.latestMoveBps >= Math.max(6, calibration.targetBps * .04) &&
    signal.shortMoveBps > 0 && signal.drawdownFromHighBps <= calibration.trailingStopBps;
  const rangeReady = signal.observedVolatilityBps >= calibration.targetBps * .55 && immediate;
  const liquiditySupported = (signal.liquidityChangeBps ?? -Infinity) >= 0 &&
    (signal.volumeChangeBps ?? -Infinity) >= -500 && immediate;
  const eligible = id === "scalper" ? rangeReady
      : id === "slow_steady" || id === "capital_preservation" || id === "signal_consensus" || id === "whale_tracker"
        ? continuing
        : id === "trend_detector" ? continuing
          : id === "liquidity_expansion" || id === "launch_transition" ? liquiditySupported
            : false; // Reversal and breakout profiles retain their required structural pattern.
  return Object.freeze({
    eligible,
    reason: eligible
      ? `Adaptive ${calibration.model} entry accepted within the token's calibrated ${calibration.regime} range`
      : `The calibrated range is tradeable, but the current movement does not yet match ${calibration.model}`,
  });
}
