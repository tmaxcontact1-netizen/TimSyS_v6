import type { MarketSnapshot } from "../market/model.js";
import { evaluateMarket } from "../market/momentum.js";
import type { TokenSecuritySnapshot } from "../token/security.js";
import { evaluateTokenSecurity } from "../token/security.js";
import { asRuleId, type Timestamp } from "../shared/types.js";
import { createRuleResult, type RuleResult } from "../shared/evidence.js";
import { scoreCandidate, type CandidateScore, type WalletConfirmation } from "./scoring.js";

export interface CandidateEvaluationInput {
  readonly evaluatedAt: Timestamp;
  readonly security: TokenSecuritySnapshot;
  readonly market: MarketSnapshot;
  readonly walletConfirmation: WalletConfirmation;
}

export interface CandidateEvaluationDecision {
  readonly eligible: boolean;
  readonly score: CandidateScore;
  readonly results: readonly RuleResult[];
  readonly failedRuleIds: readonly string[];
}

/** Combines absolute gates and score without allowing points to override a failed gate. */
export function evaluateCandidate(input: CandidateEvaluationInput): CandidateEvaluationDecision {
  const security = evaluateTokenSecurity(input.security);
  const market = evaluateMarket(input.market);
  const score = scoreCandidate({
    walletConfirmation: input.walletConfirmation,
    liquidityUsd: input.market.liquidityUsd,
    fiveMinutePriceChange: input.market.fiveMinutePriceChange,
    topTenNormalPercentage: input.security.holders?.topTenNormalPercentage ?? null,
    fiveMinuteBuyTransactions: input.market.fiveMinuteBuyTransactions,
    fiveMinuteSellTransactions: input.market.fiveMinuteSellTransactions,
  });
  const scoreResult = createRuleResult({
    ruleId: asRuleId("SCR-012"),
    outcome: score.total >= 75 ? "pass" : "fail",
    evaluatedAt: input.evaluatedAt,
    evidence: Object.freeze([...input.security.evidence, ...input.market.evidence]),
    measurements: Object.freeze([
      { name: "total_score", value: BigInt(score.total), unit: "points" },
    ]),
    reason: "Candidate score must be at least 75 points after all absolute gates pass",
  });
  const results = Object.freeze([...security.results, ...market.results, scoreResult]);
  const failedRuleIds = Object.freeze(
    results.filter(({ outcome }) => outcome !== "pass").map(({ ruleId }) => ruleId as string),
  );
  return Object.freeze({ eligible: failedRuleIds.length === 0, score, results, failedRuleIds });
}
