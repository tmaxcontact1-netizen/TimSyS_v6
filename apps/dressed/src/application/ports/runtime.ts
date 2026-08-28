import type { EntityId, Timestamp } from "../../domain/shared/types.js";
import type { ComponentHealth } from "../contracts/health.js";

export interface ClockPort {
  now(): Timestamp;
}

export interface IdGeneratorPort {
  next(): EntityId;
}

export interface HealthContributorPort {
  health(): Promise<ComponentHealth>;
}

