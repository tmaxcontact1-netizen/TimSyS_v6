import type { ExitDecision } from "../../domain/trading/exits.js";
import type { MintAddress, Timestamp } from "../../domain/shared/types.js";
import type {
  PaperPositionLease,
  PaperExitDecision,
  PaperExitMonitor,
} from "./paper-position-monitor.js";

export interface PaperExitAuthoritySource {
  evaluate(input: {
    readonly tokenMint: MintAddress;
    readonly openAmountRaw: bigint;
    readonly evaluatedAt: Timestamp;
  }): Promise<Readonly<{ decision: ExitDecision; evaluatedAt: Timestamp }>>;
}

/** Adapts the immutable deterministic exit decision to the paper lease boundary. */
export class AuthoritativePaperExitMonitor implements PaperExitMonitor {
  public constructor(private readonly authority: PaperExitAuthoritySource) {}

  public async evaluate(position: PaperPositionLease, at: Timestamp): Promise<PaperExitDecision> {
    const result = await this.authority.evaluate({
      tokenMint: position.tokenMint,
      openAmountRaw: position.openAmountRaw,
      evaluatedAt: at,
    });
    return Object.freeze({
      action: result.decision.action,
      requestedAmountRaw: result.decision.requestedAmount,
      evaluatedAt: result.evaluatedAt,
      reason: result.decision.ruleId ?? "No deterministic exit rule triggered",
    });
  }
}
