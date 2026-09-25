export interface SignalRejectionEvent {
  readonly profileId: string;
  readonly mint: string;
  readonly reason: string;
  readonly ts: string;
}

/** Profile-scoped rejection telemetry. No counter is shared between strategies. */
export class SignalGateCounter {
  readonly #counts = new Map<string, Map<string, number>>();
  readonly #events: SignalRejectionEvent[] = [];

  record(event: SignalRejectionEvent): void {
    const profile = this.#counts.get(event.profileId) ?? new Map<string, number>();
    profile.set(event.reason, (profile.get(event.reason) ?? 0) + 1);
    this.#counts.set(event.profileId, profile);
    this.#events.push(Object.freeze({ ...event }));
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
}
