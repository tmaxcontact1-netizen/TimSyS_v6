/** Insertion-ordered bounded map. Updating a key refreshes its eviction position. */
export class BoundedMap<K, V> {
  readonly #values = new Map<K, V>();

  constructor(readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity < 1)
      throw new RangeError("Bounded map capacity must be a positive integer");
  }

  set(key: K, value: V): void {
    this.#values.delete(key);
    this.#values.set(key, value);
    while (this.#values.size > this.capacity) {
      const oldest = this.#values.keys().next().value as K | undefined;
      if (oldest === undefined) break;
      this.#values.delete(oldest);
    }
  }

  get(key: K): V | undefined { return this.#values.get(key); }
  delete(key: K): boolean { return this.#values.delete(key); }
  get size(): number { return this.#values.size; }
}
