import { Decimal } from "decimal.js";

import { InvariantViolationError } from "../shared/errors.js";
import {
  createRuleResult,
  type EvidenceReference,
  type RuleMeasurement,
  type RuleResult,
} from "../shared/evidence.js";
import { asDecimal, asRuleId, type Percentage, type Timestamp } from "../shared/types.js";
import type { TokenProgram } from "./token.js";

export type AuthorityState = "active" | "revoked" | "unknown";
export type TokenExtension =
  | "transfer_fee"
  | "transfer_hook"
  | "permanent_delegate"
  | "pausable_transfer"
  | "default_account_frozen"
  | "unapproved";

export interface HolderDistribution {
  readonly topTenNormalPercentage: Percentage;
  readonly largestNormalPercentage: Percentage;
  readonly exclusionsVerified: boolean;
}

export interface TokenSecuritySnapshot {
  readonly observedAt: Timestamp;
  readonly evidence: readonly EvidenceReference[];
  readonly directlyVerifiedOnChain: boolean;
  readonly program: TokenProgram;
  readonly mintAuthority: AuthorityState;
  readonly freezeAuthority: AuthorityState;
  readonly extensions: readonly TokenExtension[];
  readonly extensionsVerified: boolean;
  readonly holders: HolderDistribution | null;
}

export interface TokenSecurityDecision {
  readonly eligible: boolean;
  readonly results: readonly RuleResult[];
  readonly failedRuleIds: readonly string[];
}

const dangerousExtensionNames = new Set<TokenExtension>([
  "transfer_fee",
  "transfer_hook",
  "permanent_delegate",
  "pausable_transfer",
  "default_account_frozen",
  "unapproved",
]);

function result(
  ruleId: string,
  failed: boolean,
  snapshot: TokenSecuritySnapshot,
  reason: string,
  measurements: readonly RuleMeasurement[],
): RuleResult {
  return createRuleResult({
    ruleId: asRuleId(ruleId),
    outcome: failed ? "fail" : "pass",
    evaluatedAt: snapshot.observedAt,
    evidence: snapshot.evidence,
    measurements,
    reason,
  });
}

function percentageMeasurement(name: string, value: Percentage | null): RuleMeasurement {
  return { name, value: value === null ? null : asDecimal(value), unit: "percent" };
}

export function evaluateTokenSecurity(snapshot: TokenSecuritySnapshot): TokenSecurityDecision {
  if (snapshot.evidence.length === 0) {
    throw new InvariantViolationError("Token security evaluation requires source evidence");
  }

  const holderDataVerified = snapshot.holders?.exclusionsVerified === true;
  const dangerousExtensions = snapshot.extensions.filter((extension) =>
    dangerousExtensionNames.has(extension),
  );

  const results = [
    result(
      "SEC-001",
      snapshot.mintAuthority !== "revoked",
      snapshot,
      snapshot.mintAuthority === "revoked"
        ? "Mint authority is revoked"
        : "Mint authority is active or unknown",
      [{ name: "mint_authority", value: snapshot.mintAuthority }],
    ),
    result(
      "SEC-002",
      snapshot.freezeAuthority !== "revoked",
      snapshot,
      snapshot.freezeAuthority === "revoked"
        ? "Freeze authority is revoked"
        : "Freeze authority is active or unknown",
      [{ name: "freeze_authority", value: snapshot.freezeAuthority }],
    ),
    result(
      "SEC-003",
      snapshot.program !== "spl_token",
      snapshot,
      snapshot.program === "spl_token"
        ? "Legacy SPL Token program is verified"
        : "Token-2022 or an unknown token program is rejected",
      [{ name: "token_program", value: snapshot.program }],
    ),
    result(
      "SEC-004",
      !snapshot.extensionsVerified || dangerousExtensions.length > 0,
      snapshot,
      snapshot.extensionsVerified && dangerousExtensions.length === 0
        ? "No dangerous or unapproved token extension exists"
        : "Dangerous extensions exist or extensions cannot be excluded",
      [
        { name: "extensions_verified", value: snapshot.extensionsVerified },
        { name: "dangerous_extensions", value: dangerousExtensions.join(",") },
      ],
    ),
    result(
      "SEC-008",
      !holderDataVerified || snapshot.holders.topTenNormalPercentage.gt(new Decimal(35)),
      snapshot,
      holderDataVerified && snapshot.holders.topTenNormalPercentage.lte(new Decimal(35))
        ? "Top ten normal holders are within the 35% limit"
        : "Top ten concentration exceeds 35% or exclusions are unverified",
      [
        percentageMeasurement(
          "top_ten_normal_holders",
          snapshot.holders?.topTenNormalPercentage ?? null,
        ),
      ],
    ),
    result(
      "SEC-010",
      !holderDataVerified || snapshot.holders.largestNormalPercentage.gt(new Decimal(8)),
      snapshot,
      holderDataVerified && snapshot.holders.largestNormalPercentage.lte(new Decimal(8))
        ? "Largest normal holder is within the 8% limit"
        : "Largest normal holder exceeds 8% or holder data is unverified",
      [
        percentageMeasurement(
          "largest_normal_holder",
          snapshot.holders?.largestNormalPercentage ?? null,
        ),
      ],
    ),
    result(
      "SEC-015",
      !snapshot.directlyVerifiedOnChain ||
        snapshot.program === "unknown" ||
        snapshot.mintAuthority === "unknown" ||
        snapshot.freezeAuthority === "unknown" ||
        !snapshot.extensionsVerified ||
        !holderDataVerified,
      snapshot,
      snapshot.directlyVerifiedOnChain &&
        snapshot.program !== "unknown" &&
        snapshot.mintAuthority !== "unknown" &&
        snapshot.freezeAuthority !== "unknown" &&
        snapshot.extensionsVerified &&
        holderDataVerified
        ? "All required token data is directly verified on-chain"
        : "Required token data is not completely verified on-chain",
      [{ name: "directly_verified_on_chain", value: snapshot.directlyVerifiedOnChain }],
    ),
  ] as const;

  const frozenResults = Object.freeze([...results]);
  const failedRuleIds = Object.freeze(
    frozenResults.filter(({ outcome }) => outcome === "fail").map(({ ruleId }) => ruleId as string),
  );

  return Object.freeze({
    eligible: failedRuleIds.length === 0,
    results: frozenResults,
    failedRuleIds,
  });
}
