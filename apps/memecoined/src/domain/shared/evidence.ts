import type {
  DecimalValue,
  EvidenceId,
  ProviderId,
  RuleId,
  SolanaSlot,
  Timestamp,
} from "./types.js";

export type EvaluationOutcome = "pass" | "fail" | "unknown" | "not_applicable";

export interface EvidenceReference {
  readonly id: EvidenceId;
  readonly provider: ProviderId;
  readonly observedAt: Timestamp;
  readonly sourceKey: string;
  readonly slot?: SolanaSlot;
  readonly contentHash?: string;
}

export interface RuleMeasurement {
  readonly name: string;
  readonly value: DecimalValue | bigint | boolean | string | null;
  readonly unit?: string;
}

export interface RuleResult {
  readonly ruleId: RuleId;
  readonly outcome: EvaluationOutcome;
  readonly evaluatedAt: Timestamp;
  readonly evidence: readonly EvidenceReference[];
  readonly measurements: readonly RuleMeasurement[];
  readonly reason: string;
}

export function createRuleResult(input: RuleResult): RuleResult {
  if (input.reason.trim().length === 0) throw new TypeError("Rule result reason is required");
  return Object.freeze({
    ...input,
    evidence: Object.freeze([...input.evidence]),
    measurements: Object.freeze([...input.measurements]),
  });
}
