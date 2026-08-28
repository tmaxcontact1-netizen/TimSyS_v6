import type { ContentHash, EntityId, EvidenceId, Timestamp } from "../../domain/shared/types.js";

export type EvidenceSource = "user" | "image" | "cv" | "rule" | "system";

export interface EvidenceReference {
  readonly id: EvidenceId;
  readonly source: EvidenceSource;
  readonly sourceEntityId: EntityId;
  readonly observedAt: Timestamp;
  readonly schemaVersion: string;
  readonly contentHash: ContentHash;
}

export type RuleOutcome = "pass" | "fail" | "unknown" | "not_applicable";

export interface RuleMeasurement {
  readonly name: string;
  readonly value: number | bigint | boolean | string | null;
  readonly unit?: string;
}

export interface RuleResult {
  readonly ruleId: string;
  readonly ruleSetVersion: string;
  readonly outcome: RuleOutcome;
  readonly scoreDelta: number;
  readonly explanationCode: string;
  readonly affectedEntityIds: readonly EntityId[];
  readonly evidence: readonly EvidenceReference[];
  readonly measurements: readonly RuleMeasurement[];
  readonly evaluatedAt: Timestamp;
}

