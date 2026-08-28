import type { Timestamp } from "../../domain/shared/types.js";

export type HealthState = "healthy" | "degraded" | "blocked" | "unavailable";

export interface ComponentHealth {
  readonly component: string;
  readonly version: string;
  readonly state: HealthState;
  readonly observedAt: Timestamp;
  readonly latencyMs: number | null;
  readonly backlog: number;
  readonly failures: number;
  readonly message: string;
}

