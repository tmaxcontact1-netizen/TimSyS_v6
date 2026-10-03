export interface RetryDecision { readonly delayMs: number; readonly retry: boolean; }
export function exponentialBackoff(attempt: number, random = Math.random): RetryDecision {
  if (!Number.isInteger(attempt) || attempt < 0) throw new Error("Retry attempt must be a non-negative integer");
  const ceiling = Math.min(30_000, 250 * 2 ** Math.min(attempt, 7));
  return Object.freeze({ delayMs: Math.floor(random() * ceiling), retry: true });
}
export class BoundedPriorityQueue<T> {
  readonly #items: { value: T; priority: number }[] = [];
  public constructor(public readonly capacity: number) { if (!Number.isInteger(capacity) || capacity < 1) throw new Error("Queue capacity must be positive"); }
  public get size(): number { return this.#items.length; }
  public push(value: T, priority: number): T | null { this.#items.push({ value, priority }); this.#items.sort((a,b)=>b.priority-a.priority); return this.#items.length > this.capacity ? this.#items.pop()!.value : null; }
  public shift(): T | null { return this.#items.shift()?.value ?? null; }
}
export function retryAfterMilliseconds(value: string | null, now = Date.now()): number | null {
  if (value === null) return null; const seconds=Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds*1000;
  const date=Date.parse(value); return Number.isNaN(date) ? null : Math.max(0,date-now);
}
