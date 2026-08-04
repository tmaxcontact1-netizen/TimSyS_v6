import { createHash } from "node:crypto";

import { createDiscoveredCandidate, type CandidateSource } from "../../domain/candidate/model.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import type {
  CandidateId,
  MintAddress,
  StrategyVersionId,
  Timestamp,
  TokenId,
} from "../../domain/shared/types.js";
import { asTimestamp, asUuid } from "../../domain/shared/types.js";
import type { CandidateDiscoveryPort } from "../ports/market.js";
import type {
  CandidateDiscoveryRepository,
  CandidateDiscoveryResult,
} from "../ports/repositories.js";

export interface CandidateDiscoveryHint {
  readonly candidateId: CandidateId;
  readonly tokenId: TokenId;
  readonly mint: MintAddress;
  readonly strategyVersionId: StrategyVersionId;
  readonly deduplicationWindow: string;
  readonly discoveredAt: Timestamp;
  readonly source: CandidateSource;
}

function deterministicUuid<Value extends string>(...parts: readonly string[]): Value {
  const hex = createHash("sha256").update(parts.join("\0")).digest("hex");
  return asUuid(
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`,
  ) as unknown as Value;
}

export interface LiveDiscoverySourceOptions {
  readonly provider: CandidateDiscoveryPort;
  readonly strategyVersionId: StrategyVersionId;
  readonly now: () => Timestamp;
  readonly deduplicationWindow: (at: Timestamp) => string;
}

/** Converts untrusted provider discovery into deterministic, retry-safe candidate hints. */
export class LiveCandidateDiscoverySource {
  public constructor(private readonly options: LiveDiscoverySourceOptions) {}

  public async nextBatch(): Promise<readonly CandidateDiscoveryHint[]> {
    const requestedAt = asTimestamp(this.options.now());
    const result = await this.options.provider.discoverLatestTokens(requestedAt);
    if (!result.ok)
      throw new InvariantViolationError(
        `Candidate discovery unavailable (${result.error.code}): ${result.error.reason}`,
      );
    const window = this.options.deduplicationWindow(requestedAt).trim();
    if (window.length === 0) throw new InvariantViolationError("Discovery window is required");
    const byMint = new Map<MintAddress, CandidateDiscoveryHint>();
    for (const observation of result.value) {
      if (observation.observedAt > requestedAt)
        throw new InvariantViolationError("Discovery observation cannot be from the future");
      if (observation.trace.provider !== "dexscreener")
        throw new InvariantViolationError("Live discovery provider identity is not approved");
      if (!byMint.has(observation.mint))
        byMint.set(
          observation.mint,
          Object.freeze({
            candidateId: deterministicUuid<CandidateId>(
              "candidate",
              this.options.strategyVersionId,
              observation.mint,
              window,
            ),
            tokenId: deterministicUuid<TokenId>("token", observation.mint),
            mint: observation.mint,
            strategyVersionId: this.options.strategyVersionId,
            deduplicationWindow: window,
            discoveredAt: requestedAt,
            source: Object.freeze({
              provider: observation.trace.provider,
              sourceReference: observation.sourceReference,
              observedAt: observation.observedAt,
              evidenceId: observation.trace.evidenceId,
            }),
          }),
        );
    }
    return Object.freeze([...byMint.values()]);
  }
}

export function candidateDeduplicationKey(input: {
  readonly mint: MintAddress;
  readonly strategyVersionId: StrategyVersionId;
  readonly window: string;
}): string {
  const window = input.window.trim();
  if (window.length === 0) throw new InvariantViolationError("Discovery window is required");
  return `${input.strategyVersionId}:${input.mint}:${window}`;
}

/** Records one normalized hint without allowing source retries to duplicate evaluation work. */
export async function discoverCandidate(
  hint: CandidateDiscoveryHint,
  repository: CandidateDiscoveryRepository,
): Promise<CandidateDiscoveryResult> {
  if (hint.source.observedAt > hint.discoveredAt)
    throw new InvariantViolationError("Discovery evidence cannot be from the future");
  return repository.recordDiscovery(
    createDiscoveredCandidate({
      id: hint.candidateId,
      tokenId: hint.tokenId,
      mint: hint.mint,
      activeDedupKey: candidateDeduplicationKey({
        mint: hint.mint,
        strategyVersionId: hint.strategyVersionId,
        window: hint.deduplicationWindow,
      }),
      state: "discovered",
      firstSeenAt: hint.discoveredAt,
      strategyVersionId: hint.strategyVersionId,
      source: hint.source,
    }),
  );
}
