import type { ClockPort } from "../../application/ports/runtime.js";
import { asTimestamp, type Timestamp } from "../../domain/shared/types.js";

export class SystemClock implements ClockPort {
  public now(): Timestamp {
    return asTimestamp(new Date().toISOString());
  }
}

