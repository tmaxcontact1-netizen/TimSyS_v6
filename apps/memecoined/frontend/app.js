const state = { data: null, profiles: [], busy: false };
function installActionFeedback() {
  window.addEventListener("timsys:action-feedback", (event) => {
    const detail = event.detail ?? {};
    if (detail.phase === "success") notify(detail.success ?? "Action completed.");
    if (detail.phase === "error") notify(detail.error ?? "The action did not complete.", true);
  });
}
const names = { fast_furious: "Fast & Furious", oscillation_trader: "Oscillation Trader" };
const descriptions = {
  fast_furious: "Short-duration trading calibrated to each coin's executable price movement.",
  oscillation_trader:
    "Mean-reversion trading when a coin repeatedly moves through a measurable range.",
};
const $ = (id) => document.getElementById(id),
  n = (value) => Number(value ?? 0);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const sol = (raw) =>
  `${(n(raw) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 5 })} SOL`;
const pct = (bps) => (bps == null ? "—" : `${n(bps) >= 0 ? "+" : ""}${(n(bps) / 100).toFixed(2)}%`);
const when = (value) => (value ? new Date(value).toLocaleString() : "—");
const short = (mint) =>
  mint && mint.length > 13 ? `${mint.slice(0, 6)}…${mint.slice(-6)}` : mint || "—";
const duration = (seconds) =>
  seconds == null
    ? "—"
    : n(seconds) < 60
      ? `${n(seconds)}s`
      : n(seconds) < 3600
        ? `${Math.round(n(seconds) / 60)}m`
        : `${(n(seconds) / 3600).toFixed(1)}h`;
const label = (id) => names[id] || id;
function notify(message, error = false) {
  const el = $("notice");
  el.textContent = message;
  el.className = `notice${error ? " error" : ""}`;
  el.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => (el.hidden = true), 5000);
}
function page(name) {
  document
    .querySelectorAll(".page")
    .forEach((el) => el.classList.toggle("active", el.dataset.pagePanel === name));
  document
    .querySelectorAll(".nav")
    .forEach((el) => el.classList.toggle("active", el.dataset.page === name));
  const copy = {
    dashboard: ["Dashboard", "What is running and whether it is making money."],
    evaluations: ["Evaluated coins", "Every recorded acceptance and rejection, with the reason."],
    trades: ["Trading history", "Open positions and completed results for both strategies."],
  }[name];
  $("page-title").textContent = copy[0];
  $("page-help").textContent = copy[1];
}
function metrics() {
  const profiles = state.data.profiles,
    closed = profiles.reduce((a, p) => a + n(p.closed_trades), 0),
    wins = profiles.reduce((a, p) => a + n(p.winning_trades), 0),
    pnl = profiles.reduce((a, p) => a + n(p.realized_pnl_raw), 0),
    accepted = profiles.reduce((a, p) => a + n(p.accepted), 0);
  $("totals").innerHTML = [
    [
      "Realised profit / loss",
      sol(pnl),
      pnl >= 0 ? "positive" : "negative",
      `${closed} closed trades`,
    ],
    [
      "Success rate",
      closed ? `${((wins / closed) * 100).toFixed(1)}%` : "—",
      "",
      `${wins} wins · ${closed - wins} losses`,
    ],
    [
      "Accepted signals",
      accepted.toLocaleString(),
      "",
      `${profiles.reduce((a, p) => a + n(p.evaluated), 0).toLocaleString()} evaluations`,
    ],
    [
      "Open positions",
      profiles.reduce((a, p) => a + n(p.open_positions), 0).toLocaleString(),
      "",
      sol(profiles.reduce((a, p) => a + n(p.open_cost_raw), 0)),
    ],
  ]
    .map(
      ([a, b, c, d]) =>
        `<article class="metric"><span>${a}</span><strong class="${c}">${b}</strong><small>${d}</small></article>`,
    )
    .join("");
}
function renderProfiles() {
  const byId = new Map(state.profiles.map((p) => [p.id, p]));
  $("profiles").innerHTML = state.data.profiles
    .map((p) => {
      const closed = n(p.closed_trades),
        wins = n(p.winning_trades),
        profit = n(p.realized_pnl_raw);
      return `<article class="profile-card"><div class="profile-top"><div><h3>${esc(label(p.profile_id))}</h3><p>${esc(descriptions[p.profile_id])}</p></div><span class="badge ${p.enabled ? "on" : ""}">${p.enabled ? "RUNNING" : "STOPPED"}</span></div><div class="profile-stats"><div><span>Evaluated</span><strong>${n(p.evaluated).toLocaleString()}</strong></div><div><span>Accepted</span><strong>${n(p.accepted).toLocaleString()}</strong></div><div><span>Success</span><strong>${closed ? ((wins / closed) * 100).toFixed(1) + "%" : "—"}</strong></div><div><span>Profit / loss</span><strong class="${profit >= 0 ? "positive" : "negative"}">${sol(profit)}</strong></div></div><div class="profile-actions"><small>${closed} closed · ${n(p.open_positions)} open · ${n(p.allocation_bps) / 100}% allocation</small><button data-toggle="${p.profile_id}" data-version="${p.version}" data-enabled="${p.enabled}">${p.enabled ? "Stop profile" : "Start profile"}</button></div></article>`;
    })
    .join("");
  document
    .querySelectorAll("[data-toggle]")
    .forEach((button) => button.addEventListener("click", () => toggleProfile(button)));
}
function reasons() {
  const rows = state.data.rejectionReasons;
  $("reason-rows").innerHTML = rows.length
    ? rows
        .map(
          (r) =>
            `<tr><td>${esc(label(r.profile_id))}</td><td class="reason">${esc(r.reason)}</td><td>${n(r.occurrences).toLocaleString()}</td><td>${n(r.tokens).toLocaleString()}</td><td>${when(r.last_seen_at)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="5" class="empty">No rejection evidence has been recorded yet.</td></tr>`;
}
function filteredEvaluations() {
  const profile = $("evaluation-profile").value,
    result = $("evaluation-result").value,
    q = $("evaluation-search").value.trim().toLowerCase();
  return state.data.evaluations.filter(
    (x) =>
      (profile === "all" || x.profile_id === profile) &&
      (result === "all" || (result === "accepted") === Boolean(x.eligible)) &&
      (!q || x.token_mint.toLowerCase().includes(q)),
  );
}
function evaluationReason(x) {
  const reasons = Array.isArray(x.rejection_reasons_json) ? x.rejection_reasons_json : [];
  return x.eligible
    ? "Passed the profile's recorded entry gates"
    : reasons.length
      ? reasons.join(" · ")
      : "Rejected without a stored reason";
}
function renderEvaluations() {
  const rows = filteredEvaluations();
  $("evaluation-summary").textContent =
    `Showing ${rows.length} of ${state.data.evaluations.length} most recent recorded evaluations.`;
  $("evaluation-rows").innerHTML = rows.length
    ? rows
        .map(
          (x) =>
            `<tr><td>${when(x.observed_at)}</td><td>${esc(label(x.profile_id))}</td><td class="coin" title="${esc(x.token_mint)}">${short(x.token_mint)}</td><td><span class="decision ${x.eligible ? "accepted" : "rejected"}">${x.eligible ? "ACCEPTED" : "REJECTED"}</span></td><td>${n(x.score)}</td><td class="reason">${esc(evaluationReason(x))}</td><td>${esc(x.outcome)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="7" class="empty">No evaluations match these filters.</td></tr>`;
}
function filteredTrades() {
  const profile = $("trade-profile").value,
    status = $("trade-status").value,
    q = $("trade-search").value.trim().toLowerCase();
  return state.data.trades.filter(
    (x) =>
      (profile === "all" || x.profile_id === profile) &&
      (status === "all" || x.lifecycle_state === status) &&
      (!q || x.token_mint.toLowerCase().includes(q)),
  );
}
function renderTrades() {
  const rows = filteredTrades(),
    closed = rows.filter((x) => x.lifecycle_state === "closed"),
    wins = closed.filter((x) => n(x.realized_net_bps) > 0);
  $("trade-summary").textContent =
    `${rows.length} shown · ${closed.length} closed · ${wins.length} profitable · ${closed.length - wins.length} unprofitable.`;
  $("trade-rows").innerHTML = rows.length
    ? rows
        .map(
          (x) =>
            `<tr><td>${esc(label(x.profile_id))}</td><td class="coin" title="${esc(x.token_mint)}">${short(x.token_mint)}</td><td>${when(x.entered_at)}</td><td>${when(x.exited_at)}</td><td class="${n(x.realized_net_bps) >= 0 ? "positive" : "negative"}"><strong>${x.lifecycle_state === "closed" ? pct(x.realized_net_bps) : "OPEN"}</strong>${x.lifecycle_state === "closed" ? `<br><small>${sol(n(x.exit_value_raw) - n(x.entry_cost_raw))}</small>` : ""}</td><td>${pct(x.maximum_favorable_excursion_bps)} / ${pct(x.maximum_adverse_excursion_bps)}</td><td>${esc(x.exit_reason || "—")}</td><td>${duration(x.holding_seconds)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="8" class="empty">No trades match these filters.</td></tr>`;
}
function render() {
  metrics();
  renderProfiles();
  reasons();
  renderEvaluations();
  renderTrades();
}
async function load() {
  if (state.busy) return;
  state.busy = true;
  $("refresh").disabled = true;
  try {
    const [data, profiles] = await Promise.all([
      fetch("/api/focused-dashboard", { cache: "no-store" }),
      fetch("/api/trading-profiles", { cache: "no-store" }),
    ]);
    if (!data.ok || !profiles.ok) throw new Error("The paper-trading records could not be loaded.");
    const body = await data.json(),
      profileBody = await profiles.json();
    state.data = body.dashboard;
    state.profiles = profileBody.profiles || [];
    render();
    $("connection").className = "connection online";
    $("connection").querySelector("strong").textContent = "Connected";
    $("last-updated").textContent = `Updated ${when(body.observedAt)}`;
  } catch (error) {
    $("connection").className = "connection offline";
    $("connection").querySelector("strong").textContent = "Disconnected";
    notify(error.message || "Unable to load MemeCoined.", true);
  } finally {
    state.busy = false;
    $("refresh").disabled = false;
  }
}
async function toggleProfile(button) {
  button.disabled = true;
  const id = button.dataset.toggle,
    enabled = button.dataset.enabled === "true",
    current = state.data.profiles.find((p) => p.profile_id === id);
  try {
    const response = await fetch(`/api/trading-profiles/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: !enabled,
        mode: "automatic_paper",
        allocationBps: n(current?.allocation_bps) || 1250,
        expectedVersion: n(button.dataset.version),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "The profile setting was not saved.");
    notify(`${label(id)} ${enabled ? "stopped" : "started"}.`);
    await load();
  } catch (error) {
    notify(error.message || "The profile setting was not saved.", true);
    button.disabled = false;
  }
}
document
  .querySelectorAll(".nav")
  .forEach((button) => button.addEventListener("click", () => page(button.dataset.page)));
["evaluation-profile", "evaluation-result", "evaluation-search"].forEach((id) =>
  $(id).addEventListener(id.includes("search") ? "input" : "change", renderEvaluations),
);
["trade-profile", "trade-status", "trade-search"].forEach((id) =>
  $(id).addEventListener(id.includes("search") ? "input" : "change", renderTrades),
);
$("refresh").addEventListener("click", load);
$("return-launcher").addEventListener(
  "click",
  () => window.electronAPI?.returnToLauncher?.() ?? window.close(),
);
installActionFeedback();
load();
setInterval(load, 30000);
