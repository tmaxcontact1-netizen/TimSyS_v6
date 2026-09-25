export type ObservationCohort = "ot_probe" | "watch" | "rotating";

export interface ObservationWork {
  readonly id: string;
  readonly tokenMint: string;
  readonly cohort: ObservationCohort;
  readonly selectedAt: string;
}

export interface ProbeCandidate {
  readonly tokenMint: string;
  readonly fairnessRank: number;
  readonly volatilityRank: number;
}

export const observationRuntimePolicy = Object.freeze({
  tickMs: 15_000,
  watchSlots: 4,
  otProbeSlots: 4,
  rotatingSlots: 8,
  rotatingEveryTicks: 2,
  workerConcurrency: 16,
  maximumQueuedAttempts: 64,
  maximumCallAttempts: 2,
  probeTenureMs: 30 * 60_000,
});

const cohortPriority: Readonly<Record<ObservationCohort, number>> = Object.freeze({
  rotating: 0,
  ot_probe: 1,
  watch: 2,
});

/** F&F and OT share four watch slots; lowest score and then oldest qualification loses capacity. */
/** Two fairness probes preserve breadth; two sparse-volatility probes provide responsiveness. */
export function allocateOtProbeSlots(
  candidates: readonly ProbeCandidate[],
): readonly ProbeCandidate[] {
  const fair = [...candidates]
    .sort(
      (left, right) =>
        left.fairnessRank - right.fairnessRank || left.tokenMint.localeCompare(right.tokenMint),
    )
    .slice(0, 2);
  const selected = new Set(fair.map(({ tokenMint }) => tokenMint));
  const responsive = candidates
    .filter(({ tokenMint }) => !selected.has(tokenMint))
    .sort(
      (left, right) =>
        right.volatilityRank - left.volatilityRank ||
        left.fairnessRank - right.fairnessRank ||
        left.tokenMint.localeCompare(right.tokenMint),
    )
    .slice(0, 2);
  return Object.freeze([...fair, ...responsive]);
}

export interface QueueAdmission {
  readonly accepted: boolean;
  readonly cancelled: ObservationWork | null;
}

/** Bounded deterministic queue: rotating is discarded before probe, probe before watch. */
export class BoundedObservationQueue<Work extends ObservationWork = ObservationWork> {
  readonly #items: Work[] = [];

  public constructor(
    public readonly capacity: number = observationRuntimePolicy.maximumQueuedAttempts,
  ) {
    if (!Number.isSafeInteger(capacity) || capacity < 1)
      throw new RangeError("Queue capacity must be positive");
  }

  public get size() {
    return this.#items.length;
  }

  public enqueue(work: Work): QueueAdmission & { readonly cancelled: Work | null } {
    if (this.#items.length < this.capacity) {
      this.#items.push(work);
      return Object.freeze({ accepted: true, cancelled: null });
    }
    const victims = this.#items
      .map((item, index) => ({ item, index }))
      .sort(
        (left, right) =>
          cohortPriority[left.item.cohort] - cohortPriority[right.item.cohort] ||
          Date.parse(right.item.selectedAt) - Date.parse(left.item.selectedAt) ||
          right.item.id.localeCompare(left.item.id),
      );
    const victim = victims[0]!;
    if (cohortPriority[victim.item.cohort] >= cohortPriority[work.cohort])
      return Object.freeze({ accepted: false, cancelled: work });
    this.#items.splice(victim.index, 1, work);
    return Object.freeze({ accepted: true, cancelled: victim.item });
  }

  public take(): Work | undefined {
    return this.#items.shift();
  }
  public snapshot(): readonly Work[] {
    return Object.freeze([...this.#items]);
  }
}
