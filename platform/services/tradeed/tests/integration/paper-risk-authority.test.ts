import { describe, expect, it } from "vitest";

import type { RiskEvaluationLease } from "../../src/application/services/risk-evaluation-work.js";
import {
  asBasisPoints,
  asPercentage,
  asRawAmount,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type MintAddress,
  type SignalId,
  type WalletAddress,
} from "../../src/domain/shared/types.js";
import { createExecutableQuote } from "../../src/domain/trading/quote.js";
import { PostgresPaperRiskAuthoritySource } from "../../src/infrastructure/database/paper-risk-authority.js";

const at = asTimestamp("2026-08-27T12:00:00.000Z");
const mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" as MintAddress;
const signalId = asUuid<SignalId>("00000000-0000-4000-8000-000000000951");
const lease: RiskEvaluationLease = { signalId, mint, leaseOwner: "paper", riskRunId: "run" };

describe("paper risk authority", () => {
  it("values durable positions with executable quotes and freezes the first snapshot", async () => {
    let persisted: readonly unknown[] | undefined;
    const database = {
      query: async (sql: string, values?: readonly unknown[]) => {
        if (sql.includes("FROM risk_authority_snapshots")) {
          if (persisted === undefined) return { rowCount: 0, rows: [] };
          return {
            rowCount: 1,
            rows: [{
              signal_id: persisted[0], mint_address: persisted[1], observed_at: persisted[2],
              content_hash: persisted[3], portfolio_json: JSON.parse(String(persisted[4])),
              breakers_json: JSON.parse(String(persisted[5])), evidence_json: JSON.parse(String(persisted[6])),
            }],
          };
        }
        if (sql.includes("INSERT INTO risk_authority_snapshots")) {
          persisted = values;
          return { rowCount: 1, rows: [] };
        }
        if (sql.includes("FROM paper_accounts")) return {
          rowCount: 1,
          rows: [{
            initial_cash_raw: "10000000000", cash_raw: "9000000000", open_cost_raw: "1000000000",
            open_position_count: "1", mint_open_cost_raw: "0", last_closed_at: null,
            today_realized_loss_raw: "200000000", all_realized_pnl_raw: "-200000000",
            seven_day_realized_loss_raw: "600000000",
          }],
        };
        if (sql.includes("FROM paper_position_lots")) return {
          rowCount: 1,
          rows: [{ token_mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6YRjJ6gP3pkfM6dV", token_amount_raw: "500", cost_raw: "1000000000" }],
        };
        if (sql.includes("FROM paper_realized_performance")) return {
          rowCount: 3,
          rows: ["-1", "-2", "-3"].map((realized_pnl_raw) => ({ realized_pnl_raw })),
        };
        throw new Error(`Unexpected query: ${sql}`);
      },
    };
    let quotes = 0;
    const swap = {
      quote: async (request: { inputMint: MintAddress; outputMint: MintAddress; inputAmount: bigint }) => {
        quotes += 1;
        const isExit = request.outputMint.startsWith("So111");
        return { ok: true as const, value: createExecutableQuote({
          fingerprint: `quote-${quotes}`, inputMint: request.inputMint, outputMint: request.outputMint,
          inputAmount: asRawAmount(request.inputAmount), expectedOutputAmount: asRawAmount(isExit ? 800000000n : 1000n),
          minimumOutputAmount: asRawAmount(isExit ? 788000000n : 985n), slippageBasisPoints: asBasisPoints(150n),
          priceImpactPercentage: asPercentage("0.5"), routePlan: ["route"], contextSlot: null,
          requestedAt: at, receivedAt: at,
          evidence: [{ id: asUuid<EvidenceId>(`00000000-0000-4000-8000-00000000095${quotes}`), provider: "jupiter", observedAt: at, sourceKey: `quote:${quotes}` }],
        }) };
      },
    };
    const source = new PostgresPaperRiskAuthoritySource(
      database as never, "paper-wallet" as WalletAddress, swap as never, () => at,
    );

    const first = await source.load(lease);
    expect(first.portfolio.equitySol?.toString()).toBe("9.8");
    expect(first.breakers.executableUnrealizedLossSol?.toString()).toBe("0.2");
    expect(first.breakers.consecutiveClosedLosingTrades).toBe(3n);
    expect(first.breakers.rollingSevenDayDrawdownPercentage?.toString()).toBe("6");
    expect(first.portfolio.liquidityCapacitySol?.toString()).toBe("0.326666666");
    expect(quotes).toBe(2);

    await source.load(lease);
    expect(quotes).toBe(2);
  });
});
