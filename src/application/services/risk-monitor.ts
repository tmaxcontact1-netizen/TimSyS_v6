import type { PortfolioSnapshot } from "../../domain/portfolio/model.js";
import {
  evaluatePositionSize,
  type PositionSizingDecision,
} from "../../domain/portfolio/sizing.js";
import {
  evaluateCircuitBreakers,
  type CircuitBreakerDecision,
  type CircuitBreakerSnapshot,
} from "../../domain/portfolio/breakers.js";

export interface RiskAssessment {
  readonly approved: boolean;
  readonly sizing: PositionSizingDecision;
  readonly breakers: CircuitBreakerDecision;
}

export function assessEntryRisk(input: {
  readonly portfolio: PortfolioSnapshot;
  readonly breakers: CircuitBreakerSnapshot;
}): RiskAssessment {
  if (input.portfolio.observedAt !== input.breakers.observedAt)
    throw new TypeError("Risk inputs must share one observation instant");
  const sizing = evaluatePositionSize(input.portfolio);
  const breakers = evaluateCircuitBreakers(input.breakers);
  return Object.freeze({ approved: sizing.eligible && breakers.entryAllowed, sizing, breakers });
}
