import { asTimestamp, type Timestamp } from "../../domain/shared/types.js";
import type { SupervisorWaitPort } from "../../workers/supervisor.js";

export class SystemSchedulerClock implements SupervisorWaitPort {
  public now(): Timestamp {
    return asTimestamp(new Date());
  }

  public wait(delayMs: number, signal: AbortSignal): Promise<void> {
    if (!Number.isSafeInteger(delayMs) || delayMs <= 0)
      return Promise.reject(new RangeError("Wait delay must be positive"));
    if (signal.aborted) return Promise.resolve();
    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", finish);
        resolve();
      };
      const timer = setTimeout(finish, delayMs);
      signal.addEventListener("abort", finish, { once: true });
    });
  }
}
