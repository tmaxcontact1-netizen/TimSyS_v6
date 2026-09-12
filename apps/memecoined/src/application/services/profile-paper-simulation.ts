import { createHash } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import type { SwapPort } from "../ports/swap.js";
import { WRAPPED_SOL_MINT } from "./portfolio-inventory-valuation.js";
import { asBasisPoints, asRawAmount, type MintAddress, type Timestamp, type WalletAddress } from "../../domain/shared/types.js";
import { tradingProfile, type PaperProfileMode, type TradingProfileDefinition, type TradingProfileId } from "../../domain/strategy/profiles.js";

export interface ProfileScoreBreakdown {
  readonly wallet: number;
  readonly liquidity: number;
  readonly momentum: number;
  readonly holders: number;
  readonly volumeQuality: number;
  readonly total: number;
}

export interface ProfileCandidateDecision {
  readonly eligible: boolean;
  readonly reasons: readonly string[];
}

/** Profile policy is deliberately deterministic and cannot override a failed safety gate. */
export function evaluateProfileCandidate(
  profile: TradingProfileDefinition,
  score: ProfileScoreBreakdown,
  failedSafetyRules: readonly string[],
): ProfileCandidateDecision {
  const reasons: string[] = [];
  if (failedSafetyRules.length) reasons.push(`Safety gates failed: ${failedSafetyRules.join(", ")}`);
  if (score.total < profile.minimumCandidateScore)
    reasons.push(`Score ${score.total} is below this profile's ${profile.minimumCandidateScore}-point threshold`);
  if (profile.requiresWhaleConfirmation && score.wallet === 0)
    reasons.push("No qualifying tracked-wallet confirmation");
  if (profile.id === "fast_furious" && (score.momentum < 12 || score.volumeQuality < 5))
    reasons.push("Short-term momentum and transaction quality do not agree");
  if (profile.id === "trend_detector" && (score.momentum < 12 || score.liquidity < 10))
    reasons.push("Emerging trend lacks sufficient momentum or liquidity");
  if (profile.id === "slow_steady" && (score.liquidity < 15 || score.holders < 8))
    reasons.push("Liquidity or holder distribution is below the long-hold standard");
  if (profile.id === "signal_consensus" && [score.wallet,score.liquidity,score.momentum,score.holders,score.volumeQuality].some((value) => value === 0))
    reasons.push("All five independent signal groups must contribute");
  return Object.freeze({ eligible: reasons.length === 0, reasons: Object.freeze(reasons) });
}

interface CandidateRow {
  readonly candidate_id: string;
  readonly mint_address: string;
  readonly total_score: number;
  readonly breakdown_json: ProfileScoreBreakdown;
  readonly failed_rules: string[] | null;
  readonly evaluated_at: Date | string;
}
interface ActivationRow {
  readonly profile_id: TradingProfileId;
  readonly mode: PaperProfileMode;
  readonly allocation_bps: number;
}
interface PositionRow {
  readonly profile_id: TradingProfileId;
  readonly token_mint: string;
  readonly candidate_id: string;
  readonly token_amount_raw: string;
  readonly cost_raw: string;
  readonly high_water_raw: string;
  readonly opened_at: Date | string;
}

const quoteSlippage = asBasisPoints(150n);
const iso = (value: Date | string): Timestamp => new Date(value).toISOString() as Timestamp;
const uuid = (parts: readonly string[]) => {
  const hex=createHash("sha256").update(parts.join("\0")).digest("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
};

async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client=await pool.connect();
  try { await client.query("BEGIN"); const result=await work(client); await client.query("COMMIT"); return result; }
  catch(error){ try{await client.query("ROLLBACK");}catch{} throw error; }
  finally{client.release();}
}

async function ensureAccounts(pool: Pool, wallet: WalletAddress, at: Timestamp): Promise<void> {
  await pool.query(
    `INSERT INTO paper_profile_accounts
       (wallet,profile_id,allocation_bps,initial_cash_raw,cash_raw,created_at,updated_at)
     SELECT a.wallet,p.profile_id,p.allocation_bps,
            GREATEST(floor(a.initial_cash_raw*p.allocation_bps/10000),1),
            GREATEST(floor(a.initial_cash_raw*p.allocation_bps/10000),1),$2,$2
     FROM paper_accounts a JOIN paper_profile_activations p ON p.wallet=a.wallet
     WHERE a.wallet=$1 AND p.enabled=true
     ON CONFLICT (wallet,profile_id) DO NOTHING`,
    [wallet,at],
  );
}

async function enterPosition(input: {
  pool: Pool; swap: Pick<SwapPort,"quote">; wallet: WalletAddress; profile: TradingProfileDefinition;
  candidate: CandidateRow; at: Timestamp; feeRaw: bigint;
}): Promise<void> {
  const state=await input.pool.query<{cash_raw:string;initial_cash_raw:string;open_positions:string}>(
    `SELECT a.cash_raw::text,a.initial_cash_raw::text,
            (SELECT count(*) FROM paper_profile_positions p WHERE p.wallet=a.wallet AND p.profile_id=a.profile_id)::text AS open_positions
       FROM paper_profile_accounts a
      WHERE a.wallet=$1 AND a.profile_id=$2
        AND NOT EXISTS (SELECT 1 FROM paper_profile_positions p WHERE p.wallet=a.wallet AND p.profile_id=a.profile_id AND p.token_mint=$3)`,
    [input.wallet,input.profile.id,input.candidate.mint_address],
  );
  const row=state.rows[0];
  if(!row || Number(row.open_positions)>=input.profile.maximumConcurrentPositions) return;
  const riskSized=(BigInt(row.initial_cash_raw)*BigInt(input.profile.riskPerTradeBps))/BigInt(input.profile.hardStopBps);
  const available=BigInt(row.cash_raw)-input.feeRaw;
  const amount=available<riskSized?available:riskSized;
  if(amount<=0n) return;
  const quoted=await input.swap.quote({inputMint:WRAPPED_SOL_MINT,outputMint:input.candidate.mint_address as MintAddress,inputAmount:asRawAmount(amount),slippageBasisPoints:quoteSlippage,requestedAt:input.at});
  if(!quoted.ok) return;
  const q=quoted.value;
  await transaction(input.pool,async(client)=>{
    const debit=await client.query(
      `UPDATE paper_profile_accounts SET cash_raw=cash_raw-$3-$4,updated_at=$5
       WHERE wallet=$1 AND profile_id=$2 AND cash_raw >= $3+$4`,
      [input.wallet,input.profile.id,q.inputAmount.toString(),input.feeRaw.toString(),input.at],
    );
    if(debit.rowCount!==1) return;
    const inserted=await client.query(
      `INSERT INTO paper_profile_positions
       (wallet,profile_id,token_mint,candidate_id,token_amount_raw,cost_raw,current_value_raw,high_water_raw,opened_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$6,$6,$7,$7) ON CONFLICT DO NOTHING`,
      [input.wallet,input.profile.id,input.candidate.mint_address,input.candidate.candidate_id,q.expectedOutputAmount.toString(),q.inputAmount.toString(),input.at],
    );
    if(inserted.rowCount!==1) throw new Error("Profile position changed during entry");
    await client.query(
      `INSERT INTO paper_profile_fills
       (id,wallet,profile_id,candidate_id,side,token_mint,token_amount_raw,settlement_amount_raw,execution_fee_raw,quote_fingerprint,reason,quoted_at,filled_at)
       VALUES ($1,$2,$3,$4,'buy',$5,$6,$7,$8,$9,'profile_entry',$10,$11)`,
      [uuid([input.wallet,input.profile.id,"buy",q.fingerprint]),input.wallet,input.profile.id,input.candidate.candidate_id,input.candidate.mint_address,q.expectedOutputAmount.toString(),q.inputAmount.toString(),input.feeRaw.toString(),q.fingerprint,q.receivedAt,input.at],
    );
  });
}

async function evaluateNewCandidates(input:{pool:Pool;swap:Pick<SwapPort,"quote">;wallet:WalletAddress;at:Timestamp;feeRaw:bigint}):Promise<void>{
  const activations=await input.pool.query<ActivationRow>(
    `SELECT profile_id,mode,allocation_bps FROM paper_profile_activations WHERE wallet=$1 AND enabled=true ORDER BY profile_id`,[input.wallet]);
  const candidates=await input.pool.query<CandidateRow>(
    `SELECT c.id::text AS candidate_id,c.mint_address,s.total_score,s.breakdown_json,
            COALESCE((SELECT array_agg(r.rule_id ORDER BY r.rule_id) FROM rule_evaluations r
                      WHERE r.evaluation_run_id=s.evaluation_run_id AND r.outcome<>'pass' AND r.rule_id<>'SCR-012'),'{}') AS failed_rules,
            s.evaluated_at
       FROM candidates c JOIN LATERAL
            (SELECT evaluation_run_id,total_score,breakdown_json,evaluated_at FROM score_breakdowns
              WHERE candidate_id=c.id ORDER BY evaluated_at DESC,id DESC LIMIT 1) s ON true
      WHERE EXISTS (SELECT 1 FROM paper_profile_activations a WHERE a.wallet=$1 AND a.enabled=true)
        AND EXISTS (SELECT 1 FROM paper_profile_activations a WHERE a.wallet=$1 AND a.enabled=true
                    AND NOT EXISTS (SELECT 1 FROM paper_profile_candidate_decisions d
                                    WHERE d.wallet=$1 AND d.profile_id=a.profile_id AND d.candidate_id=c.id))
      ORDER BY s.evaluated_at,c.id LIMIT 30`,[input.wallet]);
  for(const candidate of candidates.rows){
    for(const activation of activations.rows){
      const profile=tradingProfile(activation.profile_id); if(!profile) continue;
      const decision=evaluateProfileCandidate(profile,candidate.breakdown_json,candidate.failed_rules??[]);
      const saved=await input.pool.query(
        `INSERT INTO paper_profile_candidate_decisions
         (wallet,profile_id,candidate_id,mode,eligible,score,reasons_json,evaluated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) ON CONFLICT DO NOTHING`,
        [input.wallet,profile.id,candidate.candidate_id,activation.mode,decision.eligible,candidate.total_score,JSON.stringify(decision.reasons),input.at],
      );
      if(saved.rowCount===1&&decision.eligible&&activation.mode==="automatic_paper")
        await enterPosition({...input,profile,candidate});
    }
  }
}

async function monitorPositions(input:{pool:Pool;swap:Pick<SwapPort,"quote">;wallet:WalletAddress;at:Timestamp;feeRaw:bigint}):Promise<void>{
  const result=await input.pool.query<PositionRow>(
    `SELECT profile_id,token_mint,candidate_id,token_amount_raw::text,cost_raw::text,high_water_raw::text,opened_at
       FROM paper_profile_positions WHERE wallet=$1 ORDER BY profile_id,opened_at LIMIT 50`,[input.wallet]);
  for(const position of result.rows){
    const profile=tradingProfile(position.profile_id); if(!profile) continue;
    const quoted=await input.swap.quote({inputMint:position.token_mint as MintAddress,outputMint:WRAPPED_SOL_MINT,inputAmount:asRawAmount(BigInt(position.token_amount_raw)),slippageBasisPoints:quoteSlippage,requestedAt:input.at});
    if(!quoted.ok) continue;
    const q=quoted.value,value=q.expectedOutputAmount,cost=BigInt(position.cost_raw),high=BigInt(position.high_water_raw);
    const ageMinutes=(Date.parse(input.at)-Date.parse(iso(position.opened_at)))/60000;
    const stop=value*10000n<=cost*BigInt(10000-profile.hardStopBps);
    const target=value*10000n>=cost*BigInt(10000+profile.firstProfitTargetBps);
    const trailing=value*10000n<=high*BigInt(10000-profile.trailingStopBps)&&high>cost;
    const timeout=ageMinutes>=profile.maximumHoldingMinutes;
    if(!stop&&!target&&!trailing&&!timeout){
      await input.pool.query(`UPDATE paper_profile_positions SET current_value_raw=$4,high_water_raw=GREATEST(high_water_raw,$4),updated_at=$5 WHERE wallet=$1 AND profile_id=$2 AND token_mint=$3`,[input.wallet,profile.id,position.token_mint,value.toString(),input.at]);
      continue;
    }
    const reason=stop?"hard_stop":target?"profit_target":trailing?"trailing_stop":"time_limit";
    await transaction(input.pool,async(client)=>{
      const removed=await client.query(`DELETE FROM paper_profile_positions WHERE wallet=$1 AND profile_id=$2 AND token_mint=$3 RETURNING token_amount_raw`,[input.wallet,profile.id,position.token_mint]);
      if(removed.rowCount!==1)return;
      const net=value>input.feeRaw?value-input.feeRaw:0n;
      await client.query(`UPDATE paper_profile_accounts SET cash_raw=cash_raw+$3,realized_pnl_raw=realized_pnl_raw+($4-$5-$6),updated_at=$7 WHERE wallet=$1 AND profile_id=$2`,[input.wallet,profile.id,net.toString(),value.toString(),cost.toString(),input.feeRaw.toString(),input.at]);
      await client.query(
        `INSERT INTO paper_profile_fills
         (id,wallet,profile_id,candidate_id,side,token_mint,token_amount_raw,settlement_amount_raw,execution_fee_raw,quote_fingerprint,reason,quoted_at,filled_at)
         VALUES ($1,$2,$3,$4,'sell',$5,$6,$7,$8,$9,$10,$11,$12)`,
        [uuid([input.wallet,profile.id,"sell",q.fingerprint]),input.wallet,profile.id,position.candidate_id,position.token_mint,position.token_amount_raw,value.toString(),input.feeRaw.toString(),q.fingerprint,reason,q.receivedAt,input.at],
      );
    });
  }
}

/** Runs attributable profile decisions and independent simulated sub-portfolios using executable quotes. */
export async function runProfilePaperSimulationCycle(input:{
  readonly database:Pool; readonly swap:Pick<SwapPort,"quote">; readonly wallet:WalletAddress;
  readonly now:()=>Timestamp; readonly executionFeeRaw:bigint;
}):Promise<void>{
  const at=input.now();
  await ensureAccounts(input.database,input.wallet,at);
  await evaluateNewCandidates({pool:input.database,swap:input.swap,wallet:input.wallet,at,feeRaw:input.executionFeeRaw});
  await monitorPositions({pool:input.database,swap:input.swap,wallet:input.wallet,at,feeRaw:input.executionFeeRaw});
}

export async function readProfilePaperPerformance(database:Pick<Pool,"query">,wallet:WalletAddress){
  const result=await database.query(
    `SELECT a.profile_id,a.initial_cash_raw::text,a.cash_raw::text,a.realized_pnl_raw::text,
            COALESCE((SELECT sum(p.cost_raw) FROM paper_profile_positions p WHERE p.wallet=a.wallet AND p.profile_id=a.profile_id),0)::text AS open_cost_raw,
            COALESCE((SELECT sum(p.current_value_raw) FROM paper_profile_positions p WHERE p.wallet=a.wallet AND p.profile_id=a.profile_id),0)::text AS open_value_raw,
            (a.cash_raw+COALESCE((SELECT sum(p.current_value_raw) FROM paper_profile_positions p WHERE p.wallet=a.wallet AND p.profile_id=a.profile_id),0)-a.initial_cash_raw)::text AS net_pnl_raw,
            (SELECT count(*) FROM paper_profile_positions p WHERE p.wallet=a.wallet AND p.profile_id=a.profile_id)::int AS open_positions,
            (SELECT count(*) FROM paper_profile_fills f WHERE f.wallet=a.wallet AND f.profile_id=a.profile_id)::int AS fills,
            (SELECT count(*) FROM paper_profile_candidate_decisions d WHERE d.wallet=a.wallet AND d.profile_id=a.profile_id)::int AS candidates_evaluated,
            (SELECT count(*) FROM paper_profile_candidate_decisions d WHERE d.wallet=a.wallet AND d.profile_id=a.profile_id AND d.eligible)::int AS candidates_qualified
       FROM paper_profile_accounts a WHERE a.wallet=$1 ORDER BY a.profile_id`,[wallet]);
  return result.rows;
}
