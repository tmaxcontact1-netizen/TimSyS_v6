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
  "token-search",
  "side-filter",
  "clear-filters",
  "filter-status",
  "token-dialog",
  "token-title",
  "token-address",
  "token-amount",
  "token-cost",
  "token-pnl",
  "token-lots",
  "token-lot-rows",
  "token-fill-rows",
  "close-token",
];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
let detailSnapshot = { positions: [], fills: [], performance: [], events: [] };
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
      if (value.token) {
        cell.dataset.tokenMint = value.token;
        cell.classList.add("token-link");
      }
    }
  }
}
function amount(raw) {
  const value = String(raw ?? "0");
  return { text: BigInt(value).toLocaleString(), title: value };
}
function token(record) {
  return {
    text: short(record.token_mint),
    title: String(record.token_mint ?? ""),
    token: record.token_mint,
  };
}
function normalizedSearch() {
  return elements["token-search"].value.trim().toLowerCase();
}
function filterToken(records) {
  const query = normalizedSearch();
  return query
    ? records.filter((record) =>
        String(record.token_mint ?? "")
          .toLowerCase()
          .includes(query),
      )
    : records;
}
function renderDetails() {
  const positions = filterToken(detailSnapshot.positions);
  const performance = filterToken(detailSnapshot.performance);
  const events = filterToken(detailSnapshot.events);
  const fills = filterToken(detailSnapshot.fills).filter(
    (record) =>
      elements["side-filter"].value === "all" || record.side === elements["side-filter"].value,
  );
  elements["filter-status"].textContent =
    `Showing ${positions.length + fills.length + performance.length + events.length} records`;
  elements["position-count"].textContent = positions.length;
  elements["fill-count"].textContent = fills.length;
  elements["performance-count"].textContent = performance.length;
  elements["event-count"].textContent = events.length;
  renderRows(
    elements["position-rows"],
    positions,
    [
      token,
      (r) => amount(r.amount_raw),
      (r) => ({ text: sol(r.cost_raw) }),
      (r) => ({ text: String(r.lots) }),
      (r) => ({ text: time(r.opened_at) }),
    ],
    "No matching positions",
  );
  renderRows(
    elements["fill-rows"],
    fills,
    [
      (r) => ({ text: String(r.side).toUpperCase(), className: `side-${r.side}` }),
      token,
      (r) => amount(r.token_amount_raw),
      (r) => ({ text: sol(r.settlement_amount_raw) }),
      (r) => ({ text: time(r.filled_at) }),
    ],
    "No matching fills",
  );
  renderRows(
    elements["performance-rows"],
    performance,
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
    "No matching performance",
  );
  renderRows(
    elements["event-rows"],
    events,
    [
      (r) => ({ text: String(r.action).toUpperCase() }),
      (r) => ({ text: String(r.rule_id ?? "—") }),
      token,
      (r) => amount(r.open_amount_raw),
      (r) => amount(r.requested_amount_raw),
      (r) => ({ text: `${r.executable_value_sol} SOL` }),
      (r) => ({ text: time(r.evaluated_at) }),
    ],
    "No matching exit evaluations",
  );
}
async function openToken(mint) {
  const response = await fetch(`/api/paper/token?mint=${encodeURIComponent(mint)}`, {
    cache: "no-store",
  });
  if (!response.ok) return;
  const { token: details } = await response.json();
  elements["token-title"].textContent = short(mint);
  elements["token-address"].textContent = mint;
  elements["token-amount"].textContent = BigInt(details.summary.open_amount_raw).toLocaleString();
  elements["token-cost"].textContent = sol(details.summary.open_cost_raw);
  elements["token-pnl"].textContent = sol(details.summary.realized_pnl_raw);
  pnlClass(elements["token-pnl"], details.summary.realized_pnl_raw);
  elements["token-lots"].textContent = details.summary.open_lots;
  renderRows(
    elements["token-lot-rows"],
    details.lots,
    [
      (r) => amount(r.current_amount_raw),
      (r) => amount(r.acquired_amount_raw),
      (r) => ({ text: sol(r.remaining_cost_raw) }),
      (r) => ({ text: time(r.opened_at) }),
    ],
    "No lots",
  );
  renderRows(
    elements["token-fill-rows"],
    details.fills,
    [
      (r) => ({ text: String(r.side).toUpperCase(), className: `side-${r.side}` }),
      (r) => amount(r.token_amount_raw),
      (r) => ({ text: sol(r.settlement_amount_raw) }),
      (r) => ({ text: time(r.filled_at) }),
    ],
    "No fills",
  );
  elements["token-dialog"].showModal();
}
async function refreshDetails() {
  const response = await fetch("/api/paper/details", { cache: "no-store" });
  if (!response.ok) throw new Error("details unavailable");
  const { details } = await response.json();
  detailSnapshot = details;
  renderDetails();
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
elements["token-search"].addEventListener("input", renderDetails);
elements["side-filter"].addEventListener("change", renderDetails);
elements["clear-filters"].addEventListener("click", () => {
  elements["token-search"].value = "";
  elements["side-filter"].value = "all";
  renderDetails();
});
elements["close-token"].addEventListener("click", () => elements["token-dialog"].close());
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const cell = event.target.closest("td[data-token-mint]");
  if (cell?.dataset.tokenMint) void openToken(cell.dataset.tokenMint);
});
