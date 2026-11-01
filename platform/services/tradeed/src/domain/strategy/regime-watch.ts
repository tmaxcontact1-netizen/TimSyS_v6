export interface RegimeWatchEntry {
  readonly mint: string;
  readonly profileId: string;
  readonly qualifiedTs: number;
  readonly lastEvaluationTs: number;
  readonly regimeScore: number;
  readonly consecutiveQualifications: number;
  readonly belowFloorCycles: number;
  readonly pinned: boolean;
}

export const regimeWatchPolicy = Object.freeze({
  passScore: 60,
  decayPerCycle: 1,
  pinAfterQualifications: 5,
  maximumAgeMs: 24 * 60 * 60_000,
  removalScore: 45,
  removalCycles: 3,
  minimumPinDurationMs: 10 * 60_000,
});

const key = (profileId: string, mint: string) => `${profileId}\u0000${mint}`;

/** Deterministic state machine used by both the database adapter and density tests. */
export class RegimeWatchlist {
  readonly #entries = new Map<string, RegimeWatchEntry>();

  constructor(entries: readonly RegimeWatchEntry[] = []) {
    for (const entry of entries) this.#entries.set(key(entry.profileId, entry.mint), Object.freeze({ ...entry }));
  }

  register(mint: string, profileId: string, score: number, ts = Date.now()): RegimeWatchEntry {
    const existing = this.#entries.get(key(profileId, mint));
    const consecutive = score >= regimeWatchPolicy.passScore
      ? (existing?.consecutiveQualifications ?? 0) + 1 : 0;
    const belowFloorCycles = score < regimeWatchPolicy.removalScore
      ? (existing?.belowFloorCycles ?? 0) + 1 : 0;
    const entry = Object.freeze({
      mint, profileId,
      qualifiedTs: existing?.qualifiedTs ?? ts,
      lastEvaluationTs: ts,
      regimeScore: score >= regimeWatchPolicy.passScore
        ? score : Math.max(0, (existing?.regimeScore ?? score) - regimeWatchPolicy.decayPerCycle),
      consecutiveQualifications: consecutive,
      belowFloorCycles,
      pinned: (existing?.pinned ?? false) || consecutive >= regimeWatchPolicy.pinAfterQualifications,
    });
    this.#entries.set(key(profileId, mint), entry);
    this.#rebalancePins();
    return this.#entries.get(key(profileId, mint))!;
  }

  deregister(mint: string, profileId: string, _reason: "timeout" | "regime_lost" = "regime_lost"): boolean {
    return this.#entries.delete(key(profileId, mint));
  }

  getActiveRegimes(now = Date.now()): readonly RegimeWatchEntry[] {
    const at = now;
    for (const [entryKey, entry] of this.#entries) {
      const age = at - entry.qualifiedTs;
      const mayRemove = age >= regimeWatchPolicy.minimumPinDurationMs;
      if (age >= regimeWatchPolicy.maximumAgeMs ||
          (mayRemove && entry.belowFloorCycles >= regimeWatchPolicy.removalCycles))
        this.#entries.delete(entryKey);
    }
    return Object.freeze([...this.#entries.values()]);
  }

  getActive(now = Date.now()): readonly RegimeWatchEntry[] { return this.getActiveRegimes(now); }

  isQualified(mint: string, profileId: string, now = Date.now()): boolean {
    return this.getActiveRegimes(now).some((entry) => entry.mint === mint && entry.profileId === profileId);
  }

  #rebalancePins(): void {
    const ranked = [...this.#entries.values()]
      .filter((entry) => entry.consecutiveQualifications >= regimeWatchPolicy.pinAfterQualifications)
      .sort((left, right) => right.regimeScore - left.regimeScore ||
        right.consecutiveQualifications - left.consecutiveQualifications ||
        left.qualifiedTs - right.qualifiedTs || left.mint.localeCompare(right.mint));
    const allocated = new Set(ranked.slice(0, 8).map((entry) => key(entry.profileId, entry.mint)));
    for (const [entryKey, entry] of this.#entries)
      this.#entries.set(entryKey, Object.freeze({ ...entry, pinned: allocated.has(entryKey) }));
  }
}
