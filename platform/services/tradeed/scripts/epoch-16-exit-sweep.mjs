import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const appData = process.env.APPDATA;
const credentials = JSON.parse(
  fs.readFileSync(
    path.join(appData, "timsys-launcher", "tradeed", "postgres", "credentials.json"),
    "utf8",
  ),
);
const postmaster = fs
  .readFileSync(
    path.join(appData, "timsys-launcher", "tradeed", "postgres", "data", "postmaster.pid"),
    "utf8",
  )
  .split(/\r?\n/);

const client = new Client({
  host: "127.0.0.1",
  port: Number(postmaster[3]),
  database: "tradeed",
  user: credentials.administrator,
  password: credentials.administratorPassword,
});

await client.connect();
const outcomes = (
  await client.query(`
    SELECT signal_id,profile_id,token_mint,entered_at,exited_at,exit_reason,
           realized_net_bps::float8 AS net,
           realized_friction_bps::float8 AS friction
      FROM paper_profile_signal_outcomes
     WHERE epoch_id=16 AND lifecycle_state='closed'
     ORDER BY entered_at,signal_id`)
).rows;

for (const outcome of outcomes) {
  outcome.paths = (
    await client.query(
      `SELECT observed_at,return_bps::float8 AS bps
         FROM paper_profile_position_quote_paths
        WHERE epoch_id=16 AND profile_id=$1 AND token_mint=$2
          AND observed_at BETWEEN $3 AND $4
        ORDER BY observed_at,id`,
      [outcome.profile_id, outcome.token_mint, outcome.entered_at, outcome.exited_at],
    )
  ).rows;
}
await client.end();

const collapseTokens = new Set(
  outcomes.filter((trade) => trade.net <= -9_000).map((trade) => trade.signal_id),
);
const round = (value) => Number(value.toFixed(2));

function applyExitRule(trade, variant) {
  let high = Number.NEGATIVE_INFINITY;
  let armed = false;
  for (const point of trade.paths) {
    high = Math.max(high, point.bps);
    let triggered = false;
    if (variant.kind === "breakeven") {
      armed ||= high >= variant.arm;
      triggered = armed && point.bps <= 0;
    } else if (variant.kind === "trailing") {
      armed ||= high >= 150;
      triggered = armed && point.bps <= high - variant.distance;
    } else if (variant.kind === "ratchet") {
      armed ||= high >= variant.arm;
      triggered = armed && point.bps <= variant.arm / 2;
    }
    if (triggered) {
      return {
        net: point.bps - (Number.isFinite(trade.friction) ? trade.friction : 1.6),
        reason: variant.kind,
        observedAt: point.observed_at,
      };
    }
  }
  return { net: trade.net, reason: trade.exit_reason, observedAt: trade.exited_at };
}

function applyDefenses(results) {
  const history = new Map();
  const executed = [];
  const blocked = [];
  for (const result of results) {
    const tokenHistory = history.get(result.trade.token_mint) ?? [];
    const enteredAt = Date.parse(result.trade.entered_at);
    const recentStops = tokenHistory.filter(
      (prior) => prior.reason === "hard_stop" && enteredAt - Date.parse(prior.exitedAt) <= 4 * 3_600_000,
    ).length;
    const sessionNet = tokenHistory.reduce((sum, prior) => sum + prior.net, 0);
    if (recentStops >= 2 || sessionNet <= -500) {
      blocked.push({
        signalId: result.trade.signal_id,
        profile: result.trade.profile_id,
        token: result.trade.token_mint,
        reason: recentStops >= 2 ? "four_hour_two_stop_lockout" : "session_loss_cap",
      });
      continue;
    }
    executed.push(result);
    tokenHistory.push({ net: result.net, reason: result.reason, exitedAt: result.observedAt });
    history.set(result.trade.token_mint, tokenHistory);
  }
  return { executed, blocked };
}

function summarize(variant, withDefenses) {
  const raw = outcomes.map((trade) => ({ trade, ...applyExitRule(trade, variant) }));
  const defended = withDefenses ? applyDefenses(raw) : { executed: raw, blocked: [] };
  const blockedBySignal = new Map(defended.blocked.map((entry) => [entry.signalId, entry]));
  const changes = raw
    .map((result) => {
      const blocked = blockedBySignal.get(result.trade.signal_id);
      return blocked
        ? { ...result, net: 0, reason: blocked.reason, blocked: true }
        : { ...result, blocked: false };
    })
    .filter((result) => Math.abs(result.net - result.trade.net) > 0.005)
    .map((result) => ({
      profile: result.trade.profile_id,
      token: result.trade.token_mint,
      signalId: result.trade.signal_id,
      originalNetBps: round(result.trade.net),
      replayNetBps: round(result.net),
      deltaBps: round(result.net - result.trade.net),
      originalExit: result.trade.exit_reason,
      replayExit: result.reason,
      blocked: result.blocked,
    }));
  const totalNet = defended.executed.reduce((sum, result) => sum + result.net, 0);
  const evaluated = raw.map((result) =>
    blockedBySignal.has(result.trade.signal_id) ? { ...result, net: 0 } : result,
  );
  const winnerDegradation = evaluated.reduce(
    (sum, result) =>
      sum + (result.trade.net > 0 ? Math.max(0, result.trade.net - result.net) : 0),
    0,
  );
  const tailRecovery = evaluated.reduce(
    (sum, result) =>
      sum + (collapseTokens.has(result.trade.signal_id) ? result.net - result.trade.net : 0),
    0,
  );
  const protectedWinners = outcomes
    .filter(
      (trade) =>
        trade.net > 0 &&
        (trade.token_mint.startsWith("B4znEr") || trade.token_mint.startsWith("AFFm3")),
    )
    .map((trade) => {
      const result = raw.find((candidate) => candidate.trade.signal_id === trade.signal_id);
      return {
        token: trade.token_mint,
        retainedFraction: result ? result.net / trade.net : 0,
      };
    });
  return {
    id: variant.id,
    withDefenses,
    executedTrades: defended.executed.length,
    blocked: defended.blocked,
    totalNetBps: round(totalNet),
    expectancyBps: round(totalNet / defended.executed.length),
    winnerDegradationBps: round(winnerDegradation),
    tailRecoveryBps: round(tailRecovery),
    protectedWinners,
    changes,
  };
}

const variants = [
  { id: "baseline", kind: "baseline" },
  ...[200, 250, 300, 350, 400, 500].map((arm) => ({
    id: `breakeven_${arm}`,
    kind: "breakeven",
    arm,
  })),
  ...[150, 200, 250, 300, 350, 400, 450].map((distance) => ({
    id: `trailing_${distance}`,
    kind: "trailing",
    distance,
  })),
  ...[150, 300, 450].map((arm) => ({ id: `ratchet_${arm}`, kind: "ratchet", arm })),
];

const reports = variants.flatMap((variant) => [
  summarize(variant, false),
  summarize(variant, true),
]);
const best = [...reports].sort((left, right) => right.expectancyBps - left.expectancyBps)[0];
const collapseBaseRate = collapseTokens.size / outcomes.length;
const structural = outcomes
  .filter((trade) => trade.token_mint.startsWith("GhT9cg"))
  .map((trade) => ({
    token: trade.token_mint,
    originalNetBps: trade.net,
    variantsRescuedBy: reports
      .filter((report) =>
        report.changes.some(
          (change) => change.signalId === trade.signal_id && change.replayNetBps > -9_000,
        ),
      )
      .map((report) => `${report.id}:${report.withDefenses ? "defended" : "alone"}`),
  }));

const report = {
      epoch: 16,
      closedTrades: outcomes.length,
      collapseTrades: collapseTokens.size,
      collapseBaseRate: round(collapseBaseRate * 100),
      best,
      structural,
      summaries: reports.map(({ changes, ...summary }) => summary),
      deltas: reports.map((report) => ({
        id: report.id,
        withDefenses: report.withDefenses,
        changes: report.changes,
        blocked: report.blocked,
      })),
    };

const requestedVariant = process.argv.find((value) => value.startsWith("--deltas="))?.slice(9);
const output = process.argv.includes("--summary")
  ? { ...report, deltas: undefined, best: { ...report.best, changes: undefined } }
  : requestedVariant
    ? {
        epoch: report.epoch,
        deltas: report.deltas.filter(
          (entry) => `${entry.id}:${entry.withDefenses ? "defended" : "alone"}` === requestedVariant,
        ),
      }
    : report;
process.stdout.write(JSON.stringify(output, null, 2));
