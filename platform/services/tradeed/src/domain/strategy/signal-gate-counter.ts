export interface SignalRejectionEvent {
  readonly profileId: string;
  readonly mint: string;
  readonly reason: string;
  readonly ts: string;
}

/** Profile-scoped rejection telemetry. No counter is shared between strategies. */
export class SignalGateCounter {
  static readonly DEFAULT_EVENT_CAPACITY = 2_048;
  readonly #counts = new Map<string, Map<string, number>>();
  readonly #events: SignalRejectionEvent[] = [];

  constructor(private readonly eventCapacity = SignalGateCounter.DEFAULT_EVENT_CAPACITY) {
    if (!Number.isSafeInteger(eventCapacity) || eventCapacity < 1)
      throw new RangeError("Signal rejection event capacity must be a positive integer");
  }

  record(event: SignalRejectionEvent): void {
    const profile = this.#counts.get(event.profileId) ?? new Map<string, number>();
    profile.set(event.reason, (profile.get(event.reason) ?? 0) + 1);
    this.#counts.set(event.profileId, profile);
    this.#events.push(Object.freeze({ ...event }));
    if (this.#events.length > this.eventCapacity)
      this.#events.splice(0, this.#events.length - this.eventCapacity);
  }

  count(profileId: string, reason: string): number {
    return this.#counts.get(profileId)?.get(reason) ?? 0;
  }

  totalsByProfile(): Readonly<Record<string, number>> {
    return Object.freeze(Object.fromEntries([...this.#counts].map(([profile, reasons]) =>
      [profile, [...reasons.values()].reduce((total, count) => total + count, 0)])));
  }

  events(): readonly SignalRejectionEvent[] {
    return Object.freeze([...this.#events]);
  }

  retainedEventCount(): number {
    return this.#events.length;
  }
}
