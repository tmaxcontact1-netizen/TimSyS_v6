import pino, { type Logger } from "pino";

import type { ReconciliationEscalationPort } from "../../application/ports/runtime.js";

/** Emits a machine-readable fatal record after terminal reconciliation state is persisted. */
export class StructuredReconciliationEscalation implements ReconciliationEscalationPort {
  public constructor(private readonly logger: Pick<Logger, "fatal">) {}

  public async critical(input: Parameters<ReconciliationEscalationPort["critical"]>[0]) {
    this.logger.fatal(
      {
        event: "position_reconciliation_escalated",
        positionId: input.positionId,
        attempts: input.attempts,
        failure: input.failure,
      },
      "Position reconciliation requires operator intervention",
    );
  }
}

export function createRuntimeLogger(level: string): Logger {
  return pino({
    level,
    base: null,
    redact: { paths: ["*.apiKey", "*.secret"], censor: "[REDACTED]" },
  });
}
