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
  "performance-chart",
  "chart-range-label",
  "alert-count",
  "alert-rows",
  "refresh-now",
  "refresh-rate",
  "refresh-label",
  "connection-history",
  "allocation-total",
  "allocation-chart",
  "watchlist-count",
  "watchlist-rows",
  "toggle-watchlist",
];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
let detailSnapshot = { positions: [], fills: [], performance: [], events: [] };
let selectedRange = "7d";
let refreshTimer;
const connectionEvents = [];
const watchlistKey = "memecoined.paper.watchlist.v1";
let selectedToken = null;
let watchlist = loadWatchlist();
const sortState = {
  positions: { key: "opened_at", kind: "date", direction: "desc" },
  fills: { key: "filled_at", kind: "date", direction: "desc" },
  performance: { key: "realized_at", kind: "date", direction: "desc" },
  events: { key: "evaluated_at", kind: "date", direction: "desc" },
};
function loadWatchlist() {
  try {
    const value = JSON.parse(localStorage.getItem(watchlistKey) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((item) => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}
function saveWatchlist() {
  try {
    localStorage.setItem(watchlistKey, JSON.stringify([...watchlist].sort()));
  } catch {
    // The dashboard remains usable when browser storage is unavailable.
  }
}
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
function sorted(records, table) {
  const state = sortState[table];
  if (!state) return records;
  const direction = state.direction === "asc" ? 1 : -1;
  return [...records].sort((left, right) => {
    let a = left[state.key] ?? "";
    let b = right[state.key] ?? "";
    if (state.kind === "bigint") {
      a = BigInt(a || 0);
      b = BigInt(b || 0);
    } else if (state.kind === "date") {
      a = Date.parse(String(a)) || 0;
      b = Date.parse(String(b)) || 0;
    } else if (state.kind === "number") {
      a = Number(a) || 0;
      b = Number(b) || 0;
    } else {
      return String(a).localeCompare(String(b)) * direction;
    }
    return (a < b ? -1 : a > b ? 1 : 0) * direction;
  });
}
function renderAllocation() {
  const positions = detailSnapshot.positions;
  const total = positions.reduce((sum, item) => sum + BigInt(item.cost_raw), 0n);
  elements["allocation-total"].textContent = total === 0n ? "0 SOL" : sol(total);
  elements["allocation-chart"].replaceChildren();
  if (total === 0n) {
    const empty = document.createElement("span");
    empty.className = "empty";
    empty.textContent = "No open cost to allocate";
    elements["allocation-chart"].append(empty);
    return;
  }
  for (const position of [...positions].sort((a, b) => {
    const costOrder =
      BigInt(a.cost_raw) > BigInt(b.cost_raw)
        ? -1
        : BigInt(a.cost_raw) < BigInt(b.cost_raw)
          ? 1
          : 0;
    return costOrder || String(a.token_mint).localeCompare(String(b.token_mint));
  })) {
    const share = Number((BigInt(position.cost_raw) * 10_000n) / total) / 100;
    const row = document.createElement("button");
    row.type = "button";
    row.className = "allocation-row";
    row.dataset.tokenMint = position.token_mint;
    const label = document.createElement("span");
    label.textContent = short(position.token_mint);
    label.title = position.token_mint;
    const bar = document.createElement("i");
    bar.style.width = `${Math.max(share, 0.5)}%`;
    const value = document.createElement("strong");
    value.textContent = `${share.toFixed(2)}% · ${sol(position.cost_raw)}`;
    row.append(label, bar, value);
    elements["allocation-chart"].append(row);
  }
}
function renderWatchlist() {
  const records = [...watchlist].map((mint) => {
    const position = detailSnapshot.positions.find((item) => item.token_mint === mint);
    return {
      token_mint: mint,
      cost_raw: position?.cost_raw ?? "0",
      status: position ? "OPEN" : "WATCHING",
    };
  });
  elements["watchlist-count"].textContent = records.length;
  renderRows(
    elements["watchlist-rows"],
    records,
    [
      token,
      (r) => ({ text: sol(r.cost_raw) }),
      (r) => ({ text: r.status }),
      (r) => ({ text: "Remove", className: "watch-remove", title: r.token_mint }),
    ],
    "No watched tokens",
  );
}
function renderDetails() {
  const positions = sorted(filterToken(detailSnapshot.positions), "positions");
  const performance = sorted(filterToken(detailSnapshot.performance), "performance");
  const events = sorted(filterToken(detailSnapshot.events), "events");
  const fills = sorted(
    filterToken(detailSnapshot.fills).filter(
      (record) =>
        elements["side-filter"].value === "all" || record.side === elements["side-filter"].value,
    ),
    "fills",
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
  renderAllocation();
  renderWatchlist();
}
function renderChart(points) {
  const target = elements["performance-chart"];
  target.replaceChildren();
  if (points.length === 0) {
    const empty = document.createElement("span");
    empty.className = "empty";
    empty.textContent = "No realized performance in this range";
    target.append(empty);
    return;
  }
  const width = 1000;
  const height = 260;
  const padding = 24;
  const values = points.flatMap((point) => [
    BigInt(point.bookEquityRaw),
    BigInt(point.realizedPnlRaw),
  ]);
  const minimum = values.reduce((a, b) => (a < b ? a : b));
  const maximum = values.reduce((a, b) => (a > b ? a : b));
  const span = maximum === minimum ? 1n : maximum - minimum;
  const coordinate = (raw, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(points.length - 1, 1);
    const scaled = Number(((BigInt(raw) - minimum) * 1_000_000n) / span) / 1_000_000;
    return `${x.toFixed(2)},${(height - padding - scaled * (height - padding * 2)).toFixed(2)}`;
  };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("aria-hidden", "true");
  for (const [field, className] of [
    ["bookEquityRaw", "equity-line"],
    ["realizedPnlRaw", "pnl-line"],
  ]) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    line.setAttribute(
      "points",
      points.map((point, index) => coordinate(point[field], index)).join(" "),
    );
    line.setAttribute("class", className);
    svg.append(line);
  }
  target.append(svg);
}
async function refreshPerformance() {
  const response = await fetch(`/api/paper/performance?range=${selectedRange}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("performance unavailable");
  const { points } = await response.json();
  renderChart(points);
}
async function openToken(mint) {
  const response = await fetch(`/api/paper/token?mint=${encodeURIComponent(mint)}`, {
    cache: "no-store",
  });
  if (!response.ok) return;
  const { token: details } = await response.json();
  selectedToken = mint;
  elements["toggle-watchlist"].textContent = watchlist.has(mint)
    ? "Remove from watchlist"
    : "Add to watchlist";
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
async function refreshAlerts() {
  const response = await fetch("/api/paper/alerts", { cache: "no-store" });
  if (!response.ok) throw new Error("alerts unavailable");
  const { alerts } = await response.json();
  elements["alert-count"].textContent = alerts.length;
  renderRows(
    elements["alert-rows"],
    alerts,
    [
      (r) => ({ text: short(r.tokenMint), title: r.tokenMint, token: r.tokenMint }),
      (r) => ({ text: r.message, title: r.message, className: "alert-message" }),
      (r) => ({ text: time(r.retryAt) }),
      (r) => ({ text: time(r.lastMonitoredAt) }),
    ],
    "No unresolved worker alerts",
  );
}
function recordConnection(state, label) {
  connectionEvents.unshift({ state, label, at: new Date() });
  connectionEvents.splice(8);
  elements["connection-history"].replaceChildren();
  for (const item of connectionEvents) {
    const row = document.createElement("li");
    row.dataset.state = item.state;
    const labelNode = document.createElement("span");
    labelNode.textContent = item.label;
    const at = document.createElement("time");
    at.textContent = item.at.toLocaleTimeString();
    row.append(labelNode, at);
    elements["connection-history"].append(row);
  }
}
function scheduleRefresh() {
  clearInterval(refreshTimer);
  const milliseconds = Number(elements["refresh-rate"].value);
  elements["refresh-label"].textContent =
    milliseconds === 0 ? "Auto-refresh · paused" : `Auto-refresh · ${milliseconds / 1000} seconds`;
  if (milliseconds > 0) refreshTimer = setInterval(() => void refresh(), milliseconds);
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
    await refreshPerformance();
    await refreshAlerts();
    recordConnection("healthy", "Snapshot received");
  } catch {
    setStatus("error", "Snapshot unavailable");
    elements["integrity-title"].textContent = "Dashboard disconnected";
    elements["integrity-copy"].textContent =
      "The last durable values remain visible. Reconnecting automatically.";
    recordConnection("error", "Refresh failed");
  }
}
void refresh();
scheduleRefresh();
elements["refresh-now"].addEventListener("click", () => void refresh());
elements["refresh-rate"].addEventListener("change", scheduleRefresh);
elements["token-search"].addEventListener("input", renderDetails);
elements["side-filter"].addEventListener("change", renderDetails);
elements["clear-filters"].addEventListener("click", () => {
  elements["token-search"].value = "";
  elements["side-filter"].value = "all";
  renderDetails();
});
elements["close-token"].addEventListener("click", () => elements["token-dialog"].close());
elements["toggle-watchlist"].addEventListener("click", () => {
  if (!selectedToken) return;
  if (watchlist.has(selectedToken)) watchlist.delete(selectedToken);
  else watchlist.add(selectedToken);
  saveWatchlist();
  elements["toggle-watchlist"].textContent = watchlist.has(selectedToken)
    ? "Remove from watchlist"
    : "Add to watchlist";
  renderWatchlist();
});
document.querySelectorAll(".sort-button").forEach((button) =>
  button.addEventListener("click", () => {
    const current = sortState[button.dataset.table];
    const direction =
      current?.key === button.dataset.sort && current.direction === "asc" ? "desc" : "asc";
    sortState[button.dataset.table] = {
      key: button.dataset.sort,
      kind: button.dataset.kind ?? "text",
      direction,
    };
    document
      .querySelectorAll(`.sort-button[data-table="${button.dataset.table}"]`)
      .forEach((item) => item.removeAttribute("data-direction"));
    button.dataset.direction = direction;
    renderDetails();
  }),
);
document.querySelectorAll("[data-range]").forEach((button) =>
  button.addEventListener("click", () => {
    selectedRange = button.dataset.range;
    document
      .querySelectorAll("[data-range]")
      .forEach((item) => item.classList.toggle("active", item === button));
    elements["chart-range-label"].textContent = {
      "24h": "Last 24 hours",
      "7d": "Last 7 days",
      "30d": "Last 30 days",
      all: "All time",
    }[selectedRange];
    void refreshPerformance();
  }),
);
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const remove = event.target.closest("td.watch-remove");
  if (remove?.title) {
    watchlist.delete(remove.title);
    saveWatchlist();
    renderWatchlist();
    return;
  }
  const target = event.target.closest("[data-token-mint]");
  if (target?.dataset.tokenMint) void openToken(target.dataset.tokenMint);
});
