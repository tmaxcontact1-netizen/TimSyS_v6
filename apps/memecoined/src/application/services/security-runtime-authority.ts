import { evaluateTokenSecurity, type TokenSecuritySnapshot } from "../../domain/token/security.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";

export interface SecurityRuntimeAuthorityFacts {
  readonly dangerousSecurityChangeDetected: boolean;
}

/** Detects a newly failed security invariant relative to the immutable entry snapshot. */
export function deriveSecurityRuntimeAuthority(input: {
  readonly entry: TokenSecuritySnapshot;
  readonly current: TokenSecuritySnapshot;
}): SecurityRuntimeAuthorityFacts {
  if (input.entry.observedAt > input.current.observedAt)
    throw new InvariantViolationError("Security entry snapshot cannot follow the current snapshot");
  if (!input.entry.directlyVerifiedOnChain || !input.current.directlyVerifiedOnChain)
    throw new InvariantViolationError(
      "Runtime security authority requires direct on-chain verification",
    );

  const entry = evaluateTokenSecurity(input.entry);
  const current = evaluateTokenSecurity(input.current);
  const entryOutcomes = new Map(
    entry.results.map((result) => [result.ruleId as string, result.outcome]),
  );
  const dangerousSecurityChangeDetected = current.results.some(
    (result) => entryOutcomes.get(result.ruleId as string) === "pass" && result.outcome === "fail",
  );
  return Object.freeze({ dangerousSecurityChangeDetected });
}
