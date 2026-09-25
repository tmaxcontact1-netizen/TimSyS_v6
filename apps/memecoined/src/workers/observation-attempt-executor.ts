import {
  BoundedObservationQueue,
  observationRuntimePolicy,
  type ObservationWork,
} from "../domain/strategy/observation-runtime.js";

export interface ExecutableObservationWork<Result> extends ObservationWork {
  readonly execute: () => Promise<Result>;
  readonly cancel: () => Promise<void>;
}

interface Deferred<Result> {
  readonly resolve: (value: Result | null) => void;
  readonly reject: (reason: unknown) => void;
}

/**
 * The production attempt queue. It is the sole overload authority: one bounded
 * queue, one priority policy, and one concurrency limit are shared by all ticks.
 */
export class ObservationAttemptExecutor<Result> {
  readonly #queue = new BoundedObservationQueue<ExecutableObservationWork<Result>>();
  readonly #deferred = new Map<string, Deferred<Result>>();
  #active = 0;
  #maximumDepth = 0;

  public constructor(
    private readonly concurrency: number = observationRuntimePolicy.workerConcurrency,
  ) {}

  public get depth(): number {
    return this.#queue.size;
  }

  public get active(): number {
    return this.#active;
  }

  public get maximumDepth(): number {
    return this.#maximumDepth;
  }

  public submit(work: ExecutableObservationWork<Result>): Promise<Result | null> {
    return new Promise<Result | null>((resolve, reject) => {
      this.#deferred.set(work.id, { resolve, reject });
      const admission = this.#queue.enqueue(work);
      this.#maximumDepth = Math.max(this.#maximumDepth, this.#queue.size);
      if (admission.cancelled !== null) void this.#cancel(admission.cancelled);
      if (!admission.accepted) return;
      this.#pump();
    });
  }

  async #cancel(work: ExecutableObservationWork<Result>): Promise<void> {
    const deferred = this.#deferred.get(work.id);
    try {
      await work.cancel();
      deferred?.resolve(null);
    } catch (error) {
      deferred?.reject(error);
    } finally {
      this.#deferred.delete(work.id);
    }
  }

  #pump(): void {
    while (this.#active < this.concurrency) {
      const work = this.#queue.take();
      if (work === undefined) return;
      this.#active += 1;
      void work
        .execute()
        .then((value) => this.#deferred.get(work.id)?.resolve(value))
        .catch((error) => this.#deferred.get(work.id)?.reject(error))
        .finally(() => {
          this.#deferred.delete(work.id);
          this.#active -= 1;
          this.#pump();
        });
    }
  }
}
