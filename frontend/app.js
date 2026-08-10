const lamportsPerSol = 1_000_000_000n;
const ids = [
  "status",
  "status-label",
  "equity",
  "equity-change",
  "cash",
  "open-cost",
  "open-positions",
  "pnl",
  "fills",
  "entries",
  "positions-due",
  "integrity-title",
  "integrity-copy",
  "errors",
  "wallet",
  "observed",
  "position-count",
  "fill-count",
  "performance-count",
  "event-count",
  "position-rows",
  "fill-rows",
  "performance-rows",
  "event-rows",
];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
function sol(raw) {
  const value = BigInt(raw);
  const absolute = value < 0n ? -value : value;
  const whole = absolute / lamportsPerSol;
  const fraction = (absolute % lamportsPerSol)
    .toString()
    .padStart(9, "0")
    .slice(0, 4)
    .replace(/0+$/, "");
  return `${value < 0n ? "−" : ""}${whole.toLocaleString()}${fraction ? `.${fraction}` : ""} SOL`;
}
function setStatus(state, label) {
  elements.status.dataset.state = state;
  elements["status-label"].textContent = label;
}
function pnlClass(node, raw) {
  node.classList.remove("positive", "negative");
  if (BigInt(raw) > 0n) node.classList.add("positive");
  if (BigInt(raw) < 0n) node.classList.add("negative");
}
function short(value) {
  const text = String(value ?? "—");
  return text.length > 16 ? `${text.slice(0, 6)}…${text.slice(-6)}` : text;
}
function time(value) {
  return value ? new Date(String(value)).toLocaleString() : "—";
}
function renderRows(target, records, cells, empty) {
  target.replaceChildren();
  if (records.length === 0) {
    const row = target.insertRow();
    const cell = row.insertCell();
    cell.colSpan = cells.length;
    cell.className = "empty";
    cell.textContent = empty;
    return;
  }
  for (const record of records) {
    const row = target.insertRow();
    for (const render of cells) {
      const cell = row.insertCell();
      const value = render(record);
      cell.textContent = value.text;
      if (value.className) cell.className = value.className;
      if (value.title) cell.title = value.title;
    }
  }
}
function amount(raw) {
  const value = String(raw ?? "0");
  return { text: BigInt(value).toLocaleString(), title: value };
}
function token(record) {
  return { text: short(record.token_mint), title: String(record.token_mint ?? "") };
}
async function refreshDetails() {
  const response = await fetch("/api/paper/details", { cache: "no-store" });
  if (!response.ok) throw new Error("details unavailable");
  const { details } = await response.json();
  elements["position-count"].textContent = details.positions.length;
  elements["fill-count"].textContent = details.fills.length;
  elements["performance-count"].textContent = details.performance.length;
  elements["event-count"].textContent = details.events.length;
  renderRows(
    elements["position-rows"],
    details.positions,
    [
      token,
      (r) => amount(r.amount_raw),
      (r) => ({ text: sol(r.cost_raw) }),
      (r) => ({ text: String(r.lots) }),
      (r) => ({ text: time(r.opened_at) }),
    ],
    "No open positions",
  );
  renderRows(
    elements["fill-rows"],
    details.fills,
    [
      (r) => ({ text: String(r.side).toUpperCase(), className: `side-${r.side}` }),
      token,
      (r) => amount(r.token_amount_raw),
      (r) => ({ text: sol(r.settlement_amount_raw) }),
      (r) => ({ text: time(r.filled_at) }),
    ],
    "No fills recorded",
  );
  renderRows(
    elements["performance-rows"],
    details.performance,
    [
      token,
      (r) => ({ text: sol(r.proceeds_raw) }),
      (r) => ({ text: sol(r.released_cost_raw) }),
      (r) => ({
        text: sol(r.realized_pnl_raw),
        className: BigInt(r.realized_pnl_raw) >= 0n ? "positive" : "negative",
      }),
      (r) => ({ text: time(r.realized_at) }),
    ],
    "No realized performance",
  );
  renderRows(
    elements["event-rows"],
    details.events,
    [
      (r) => ({ text: String(r.action).toUpperCase() }),
      (r) => ({ text: String(r.rule_id ?? "—") }),
      token,
      (r) => amount(r.open_amount_raw),
      (r) => amount(r.requested_amount_raw),
      (r) => ({ text: `${r.executable_value_sol} SOL` }),
      (r) => ({ text: time(r.evaluated_at) }),
    ],
    "No exit evaluations",
  );
}
async function refresh() {
  try {
    const response = await fetch("/api/paper/snapshot", { cache: "no-store" });
    if (!response.ok) throw new Error("snapshot unavailable");
    const { observedAt, performance } = await response.json();
    const equity = BigInt(performance.cashRaw) + BigInt(performance.openCostRaw);
    const change = equity - BigInt(performance.initialCashRaw);
    elements.equity.textContent = sol(equity.toString());
    elements["equity-change"].textContent =
      `${change >= 0n ? "+" : ""}${sol(change.toString())} from initial cash`;
    pnlClass(elements["equity-change"], change.toString());
    elements.cash.textContent = sol(performance.cashRaw);
    elements["open-cost"].textContent = sol(performance.openCostRaw);
    elements["open-positions"].textContent =
      `${performance.openPositions} open position${performance.openPositions === 1 ? "" : "s"}`;
    elements.pnl.textContent = `${BigInt(performance.realizedPnlRaw) > 0n ? "+" : ""}${sol(performance.realizedPnlRaw)}`;
    pnlClass(elements.pnl, performance.realizedPnlRaw);
    elements.fills.textContent = performance.fills;
    elements.entries.textContent = performance.pendingEntries;
    elements["positions-due"].textContent = performance.pendingPositions;
    elements.errors.textContent = performance.workerErrors;
    elements.wallet.textContent = `${performance.wallet.slice(0, 6)}…${performance.wallet.slice(-6)}`;
    elements.observed.textContent = new Date(observedAt).toLocaleTimeString();
    elements["integrity-title"].textContent = performance.healthy
      ? "Runtime facts are healthy"
      : "Worker intervention required";
    elements["integrity-copy"].textContent = performance.healthy
      ? "The durable paper ledger reports no unresolved worker errors."
      : `${performance.workerErrors} durable worker error${performance.workerErrors === 1 ? "" : "s"} require review.`;
    setStatus(
      performance.healthy ? "healthy" : "unhealthy",
      performance.healthy ? "Healthy" : "Attention required",
    );
    await refreshDetails();
  } catch {
    setStatus("error", "Snapshot unavailable");
    elements["integrity-title"].textContent = "Dashboard disconnected";
    elements["integrity-copy"].textContent =
      "The last durable values remain visible. Reconnecting automatically.";
  }
}
void refresh();
setInterval(() => void refresh(), 10_000);
