import type { PlatformRuleResult } from "@timsys/app-sdk";
import type { RuleResult } from "../../domain/shared/evidence.js";
import type { ObservationTrace } from "./observations.js";

export const platformContracts = Object.freeze({ protocol: "timsys.application.v1", evidence: "v1", rules: "v1", health: "v1" });

export function observationEvidence(trace: ObservationTrace) {
  return Object.freeze({
    id: String(trace.evidenceId), kind: "provider-observation", source: String(trace.provider), sourceKey: trace.sourceKey,
    observedAt: String(trace.sourceTimestamp ?? trace.respondedAt), recordedAt: String(trace.normalizedAt),
    contentHash: trace.contentHash, schemaVersion: "memecoined.observation.v1",
    provenance: Object.freeze({ method: trace.method, requestedAt: trace.requestedAt, respondedAt: trace.respondedAt, ...(trace.slot === undefined ? {} : { slot: trace.slot }) }),
  });
}

export function platformRuleResult(result: RuleResult, ruleSetVersion: string): PlatformRuleResult {
  return Object.freeze({
    ruleId: String(result.ruleId), ruleSetVersion, outcome: result.outcome, evaluatedAt: String(result.evaluatedAt),
    explanation: result.reason, evidenceIds: result.evidence.map((item) => String(item.id)),
    measurements: result.measurements.map((item) => Object.freeze({ name: item.name, value: typeof item.value === "bigint" ? item.value.toString() : item.value, ...(item.unit === undefined ? {} : { unit: item.unit }) })),
  });
}
