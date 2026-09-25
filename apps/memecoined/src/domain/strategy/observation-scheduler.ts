export const observationSchedulePolicy = Object.freeze({
  maximumPinned: 8,
  maximumRotating: 8,
  pinnedIntervalMs: 15_000,
  rotatingMinimumIntervalMs: 30_000,
  rotatingMaximumIntervalMs: 60_000,
});

export interface ObservationCandidate {
  readonly mint: string;
  readonly pinned: boolean;
  readonly lastObservedAt: string | null;
  readonly priority?: number;
}

export function scheduleObservations(
  candidates: readonly ObservationCandidate[], now: string,
): readonly ObservationCandidate[] {
  const at = Date.parse(now);
  const due = (candidate: ObservationCandidate, interval: number) => candidate.lastObservedAt === null ||
    at - Date.parse(candidate.lastObservedAt) >= interval;
  const order = (left: ObservationCandidate, right: ObservationCandidate) =>
    Date.parse(left.lastObservedAt ?? "1970-01-01") - Date.parse(right.lastObservedAt ?? "1970-01-01") ||
    (right.priority ?? 0) - (left.priority ?? 0) || left.mint.localeCompare(right.mint);
  const pinned = candidates.filter((candidate) => candidate.pinned &&
    due(candidate, observationSchedulePolicy.pinnedIntervalMs)).sort(order)
    .slice(0, observationSchedulePolicy.maximumPinned);
  const rotatingLimit = observationSchedulePolicy.maximumRotating +
    (observationSchedulePolicy.maximumPinned - pinned.length);
  const rotating = candidates.filter((candidate) => !candidate.pinned &&
    due(candidate, observationSchedulePolicy.rotatingMinimumIntervalMs)).sort(order)
    .slice(0, rotatingLimit);
  return Object.freeze([...pinned, ...rotating]);
}
