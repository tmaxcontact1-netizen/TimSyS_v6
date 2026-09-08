import type { PlatformRuleResult } from "@timsys/app-sdk";
import type { EvidenceReference, RuleResult } from "./evidence.js";

export const platformContracts = Object.freeze({ protocol: "timsys.application.v1", evidence: "v1", rules: "v1", health: "v1" });

export function platformEvidence(reference: EvidenceReference) {
  return Object.freeze({
    id: String(reference.id), kind: "entity-evidence", source: reference.source, sourceKey: String(reference.sourceEntityId),
    observedAt: String(reference.observedAt), recordedAt: String(reference.observedAt), contentHash: String(reference.contentHash),
    schemaVersion: reference.schemaVersion, provenance: Object.freeze({ sourceEntityId: reference.sourceEntityId }),
  });
}

export function platformRuleResult(result: RuleResult): PlatformRuleResult {
  return Object.freeze({
    ruleId: result.ruleId, ruleSetVersion: result.ruleSetVersion, outcome: result.outcome, evaluatedAt: String(result.evaluatedAt),
    explanation: result.explanationCode, evidenceIds: result.evidence.map((item) => String(item.id)),
    measurements: result.measurements.map((item) => Object.freeze({ name: item.name, value: typeof item.value === "bigint" ? item.value.toString() : item.value, ...(item.unit === undefined ? {} : { unit: item.unit }) })),
  });
}
