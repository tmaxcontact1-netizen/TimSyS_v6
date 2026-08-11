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
  "pending-entry-count",
  "fill-count",
  "performance-count",
  "event-count",
  "position-rows",
  "pending-entry-rows",
  "paper-control-message",
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
  "watchlist-select",
  "watchlist-create",
  "watchlist-rename",
  "watchlist-delete",
  "watchlist-token",
  "watchlist-connect",
  "watchlist-import",
  "watchlist-message",
  "configuration-count",
  "configuration-select",
  "configuration-new",
  "configuration-delete",
  "configuration-form",
  "configuration-name",
  "configuration-strategy",
  "configuration-positions",
  "configuration-risk",
  "configuration-position-equity",
  "configuration-exposure",
  "configuration-reserve",
  "configuration-slippage",
  "configuration-save",
  "configuration-message",
  "menu-toggle",
  "sidebar-backdrop",
  "sidebar-collapse",
  "preferences-open",
  "preferences-dialog",
  "preferences-close",
  "preferences-reset",
  "preferences-done",
  "panel-preferences",
  "theme-preference",
  "high-contrast",
  "large-text",
  "reduce-motion",
  "preferences-export",
  "preferences-import",
  "preferences-message",
];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
let detailSnapshot = { positions: [], pendingEntries: [], fills: [], performance: [], events: [] };
let selectedRange = "7d";
let refreshTimer;
const connectionEvents = [];
const watchlistKey = "memecoined.paper.watchlist.v1";
const preferencesKey = "memecoined.paper.preferences.v1";
const defaultPanelOrder = [
  "overview",
  "portfolio",
  "configurations",
  "alerts",
  "performance",
  "operations",
  "filters",
  "trading",
];
let selectedToken = null;
const legacyWatchlist = loadWatchlist();
let watchlists = [];
let activeWatchlistId = "";
let mutationToken = "";
let configurations = [];
let activeConfigurationId = "";
let preferences = loadPreferences();
const sortState = {
  positions: { key: "opened_at", kind: "date", direction: "desc" },
  fills: { key: "filled_at", kind: "date", direction: "desc" },
  performance: { key: "realized_at", kind: "date", direction: "desc" },
  events: { key: "evaluated_at", kind: "date", direction: "desc" },
};
function loadPreferences() {
  try {
    const value = JSON.parse(localStorage.getItem(preferencesKey) ?? "{}");
    return normalizePreferences(value);
  } catch {
    return defaultPreferences();
  }
}
function normalizePreferences(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultPreferences();
  const storedOrder = Array.isArray(value.panelOrder)
    ? value.panelOrder.filter((id) => defaultPanelOrder.includes(id))
    : [];
  const panelOrder = [...new Set([...storedOrder, ...defaultPanelOrder])];
  const hiddenPanels = Array.isArray(value.hiddenPanels)
    ? [...new Set(value.hiddenPanels)].filter(
        (id) => id !== "overview" && defaultPanelOrder.includes(id),
      )
    : [];
  return {
    density: value.density === "compact" ? "compact" : "detailed",
    sidebar: value.sidebar === "collapsed" ? "collapsed" : "expanded",
    theme: ["system", "dark", "light"].includes(value.theme) ? value.theme : "system",
    contrast: value.contrast === "high" ? "high" : "standard",
    text: value.text === "large" ? "large" : "standard",
    motion: value.motion === "reduced" ? "reduced" : "full",
    panelOrder,
    hiddenPanels,
  };
}
function defaultPreferences() {
  return {
    density: "detailed",
    sidebar: "expanded",
    theme: "system",
    contrast: "standard",
    text: "standard",
    motion: "full",
    panelOrder: [...defaultPanelOrder],
    hiddenPanels: [],
  };
}
function renderPanelPreferences() {
  elements["panel-preferences"].replaceChildren();
  preferences.panelOrder.forEach((id, index) => {
    const panel = document.querySelector(`[data-dashboard-panel="${id}"]`);
    if (!(panel instanceof HTMLElement)) return;
    const row = document.createElement("div");
    row.className = "panel-preference-row";
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !preferences.hiddenPanels.includes(id);
    checkbox.disabled = id === "overview";
    checkbox.dataset.panelVisibility = id;
    label.append(checkbox, document.createTextNode(panel.dataset.panelTitle ?? id));
    const controls = document.createElement("span");
    for (const [action, text, disabled] of [
      ["up", "Move up", index === 0],
      ["down", "Move down", index === preferences.panelOrder.length - 1],
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.disabled = disabled;
      button.dataset.panelMove = action;
      button.dataset.panelId = id;
      controls.append(button);
    }
    row.append(label, controls);
    elements["panel-preferences"].append(row);
  });
}
function applyPanelPreferences() {
  const main = document.querySelector("main");
  if (!(main instanceof HTMLElement)) return;
  for (const id of preferences.panelOrder) {
    const panel = main.querySelector(`[data-dashboard-panel="${id}"]`);
    if (!(panel instanceof HTMLElement)) continue;
    panel.hidden = preferences.hiddenPanels.includes(id);
    main.append(panel);
  }
  renderPanelPreferences();
}
function applyPreferences() {
  document.body.dataset.density = preferences.density;
  document.body.dataset.sidebar = preferences.sidebar;
  document.documentElement.dataset.theme = preferences.theme;
  document.documentElement.dataset.contrast = preferences.contrast;
  document.documentElement.dataset.text = preferences.text;
  document.documentElement.dataset.motion = preferences.motion;
  elements["sidebar-collapse"].ariaPressed = String(preferences.sidebar === "collapsed");
  elements["sidebar-collapse"].textContent =
    preferences.sidebar === "collapsed" ? "Expand sidebar" : "Collapse sidebar";
  const density = document.querySelector(`input[name="density"][value="${preferences.density}"]`);
  if (density instanceof HTMLInputElement) density.checked = true;
  elements["theme-preference"].value = preferences.theme;
  elements["high-contrast"].checked = preferences.contrast === "high";
  elements["large-text"].checked = preferences.text === "large";
  elements["reduce-motion"].checked = preferences.motion === "reduced";
  applyPanelPreferences();
}
function setPreferenceMessage(message, state = "ok") {
  elements["preferences-message"].textContent = message;
  elements["preferences-message"].dataset.state = state;
}
function exportPreferences() {
  const payload = JSON.stringify(
    { schema: "memecoined-dashboard-preferences", version: 1, preferences },
    null,
    2,
  );
  const url = URL.createObjectURL(new Blob([`${payload}\n`], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "memecoined-dashboard-preferences.json";
  link.click();
  URL.revokeObjectURL(url);
  setPreferenceMessage("Preferences exported.");
}
async function importPreferences(file) {
  if (!(file instanceof File)) return;
  try {
    if (file.size > 32_768) throw new Error("Preference file exceeds 32 KB.");
    const payload = JSON.parse(await file.text());
    if (
      payload?.schema !== "memecoined-dashboard-preferences" ||
      payload?.version !== 1 ||
      !payload.preferences
    ) {
      throw new Error("Not a supported Memecoined preference file.");
    }
    preferences = normalizePreferences(payload.preferences);
    savePreferences();
    setPreferenceMessage("Preferences imported and applied.");
  } catch (error) {
    setPreferenceMessage(
      error instanceof Error ? error.message : "Preference import failed.",
      "error",
    );
  } finally {
    elements["preferences-import"].value = "";
  }
}
function savePreferences() {
  try {
    localStorage.setItem(preferencesKey, JSON.stringify(preferences));
  } catch {
    // Display preferences are optional when browser storage is unavailable.
  }
  applyPreferences();
}
function closeMenu() {
  document.body.dataset.menu = "closed";
  elements["menu-toggle"].ariaExpanded = "false";
}
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
    localStorage.setItem(watchlistKey, JSON.stringify([...legacyWatchlist].sort()));
  } catch {
    // The dashboard remains usable when browser storage is unavailable.
  }
}
function activeWatchlist() {
  return watchlists.find((item) => item.id === activeWatchlistId) ?? null;
}
function watchedTokens() {
  return new Set(activeWatchlist()?.tokens ?? []);
}
function setWatchlistMessage(message, state = "ok") {
  elements["watchlist-message"].textContent = message;
  elements["watchlist-message"].dataset.state = state;
}
function activeConfiguration() {
  return configurations.find((item) => item.id === activeConfigurationId) ?? null;
}
function setConfigurationMessage(message, state = "ok") {
  elements["configuration-message"].textContent = message;
  elements["configuration-message"].dataset.state = state;
}
function configurationValues() {
  const number = (id) => Number(elements[id].value);
  return {
    name: elements["configuration-name"].value.trim(),
    strategyVersionId: elements["configuration-strategy"].value.trim(),
    maximumConcurrentPositions: number("configuration-positions"),
    riskPerTradeBps: number("configuration-risk"),
    maximumPositionEquityBps: number("configuration-position-equity"),
    maximumOpenExposureBps: number("configuration-exposure"),
    minimumUncommittedEquityBps: number("configuration-reserve"),
    entrySlippageBps: number("configuration-slippage"),
  };
}
function renderConfigurations() {
  const selected = activeConfiguration();
  elements["configuration-count"].textContent = configurations.length;
  elements["configuration-select"].replaceChildren();
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "New draft";
  elements["configuration-select"].append(blank);
  for (const item of configurations) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.name} · v${item.version}`;
    elements["configuration-select"].append(option);
  }
  elements["configuration-select"].value = selected?.id ?? "";
  const values = selected ?? {};
  for (const [id, key] of [
    ["configuration-name", "name"],
    ["configuration-strategy", "strategyVersionId"],
    ["configuration-positions", "maximumConcurrentPositions"],
    ["configuration-risk", "riskPerTradeBps"],
    ["configuration-position-equity", "maximumPositionEquityBps"],
    ["configuration-exposure", "maximumOpenExposureBps"],
    ["configuration-reserve", "minimumUncommittedEquityBps"],
    ["configuration-slippage", "entrySlippageBps"],
  ])
    elements[id].value = values[key] ?? "";
  elements["configuration-delete"].disabled = !mutationToken || !selected;
  elements["configuration-save"].disabled = !mutationToken;
  elements["configuration-save"].textContent = selected ? "Save draft" : "Create draft";
}
async function refreshConfigurations() {
  const response = await fetch("/api/trading-configurations", { cache: "no-store" });
  if (!response.ok) throw new Error("Trading configurations unavailable.");
  configurations = (await response.json()).configurations;
  if (!configurations.some((item) => item.id === activeConfigurationId)) activeConfigurationId = "";
  renderConfigurations();
}
async function mutateConfiguration(path, method, body) {
  try {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mutationToken}` },
      body: JSON.stringify(body),
    });
    if (response.status === 204) {
      activeConfigurationId = "";
      await refreshConfigurations();
      setConfigurationMessage("Draft deleted.");
      return;
    }
    if (!response.ok) {
      if (response.status === 409) await refreshConfigurations();
      throw new Error(
        response.status === 409
          ? "Draft changed elsewhere; authoritative values reloaded."
          : "Draft mutation failed.",
      );
    }
    const { configuration } = await response.json();
    activeConfigurationId = configuration.id;
    await refreshConfigurations();
    setConfigurationMessage(method === "POST" ? "Draft created." : "Draft saved.");
  } catch (error) {
    setConfigurationMessage(
      error instanceof Error ? error.message : "Draft mutation failed.",
      "error",
    );
  }
}
function renderWatchlistControls() {
  const selected = activeWatchlist();
  elements["watchlist-select"].replaceChildren();
  if (watchlists.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No persistent lists";
    elements["watchlist-select"].append(option);
  } else {
    for (const item of watchlists) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.name} (${item.tokens.length})`;
      elements["watchlist-select"].append(option);
    }
    elements["watchlist-select"].value = selected?.id ?? watchlists[0].id;
  }
  const enabled = mutationToken.length > 0;
  elements["watchlist-create"].disabled = !enabled;
  elements["watchlist-rename"].disabled = !enabled || !selected;
  elements["watchlist-delete"].disabled = !enabled || !selected;
  elements["watchlist-import"].hidden = legacyWatchlist.size === 0;
  elements["watchlist-import"].disabled = !enabled;
}
async function watchlistRequest(path, method = "GET", body) {
  const options = { method, cache: "no-store", headers: {} };
  if (method !== "GET") {
    options.headers = {
      Authorization: `Bearer ${mutationToken}`,
      "Content-Type": "application/json",
    };
    options.body = JSON.stringify(body ?? {});
  }
  const response = await fetch(path, options);
  if (response.status === 409) throw new Error("This list changed. Refresh and try again.");
  if (response.status === 401 || response.status === 403)
    throw new Error("Mutation token rejected.");
  if (!response.ok) throw new Error("Watchlist request failed.");
  return response.status === 204 ? null : response.json();
}
async function refreshWatchlists() {
  const { watchlists: records } = await watchlistRequest("/api/watchlists");
  watchlists = records;
  if (!watchlists.some((item) => item.id === activeWatchlistId))
    activeWatchlistId = watchlists[0]?.id ?? "";
  renderWatchlistControls();
  renderWatchlist();
}
function replaceWatchlist(updated) {
  watchlists = watchlists.map((item) => (item.id === updated.id ? updated : item));
  activeWatchlistId = updated.id;
  renderWatchlistControls();
  renderWatchlist();
}
async function mutateWatchlist(path, method, body) {
  try {
    const result = await watchlistRequest(path, method, body);
    if (result?.watchlist) replaceWatchlist(result.watchlist);
    setWatchlistMessage("Watchlist saved.");
    return result;
  } catch (error) {
    setWatchlistMessage(
      error instanceof Error ? error.message : "Watchlist change failed.",
      "error",
    );
    await refreshWatchlists().catch(() => undefined);
    return null;
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
      if (value.action) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = value.text;
        button.dataset.paperAction = value.action;
        for (const [key, item] of Object.entries(value.data ?? {})) button.dataset[key] = item;
        button.disabled = Boolean(value.disabled);
        cell.append(button);
        continue;
      }
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
  const records = [...watchedTokens()].map((mint) => {
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
  const pendingEntries = filterToken(detailSnapshot.pendingEntries);
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
  elements["pending-entry-count"].textContent = pendingEntries.length;
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
      (r) => ({
        text: r.close_pending ? "Close requested" : "Request full close",
        action: "close-position",
        disabled: !mutationToken || r.close_pending,
        data: { mint: r.token_mint, amountRaw: r.amount_raw },
      }),
    ],
    "No matching positions",
  );
  renderRows(
    elements["pending-entry-rows"],
    pendingEntries,
    [
      token,
      (r) => amount(r.input_amount_raw),
      (r) => ({ text: time(r.created_at) }),
      (r) => ({
        text: "Cancel entry",
        action: "cancel-entry",
        disabled: !mutationToken,
        data: { signalId: r.signal_id, version: String(r.version) },
      }),
    ],
    "No cancellable paper entries",
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
  const selectedList = activeWatchlist();
  elements["toggle-watchlist"].disabled = !mutationToken || !selectedList;
  elements["toggle-watchlist"].textContent = watchedTokens().has(mint)
    ? "Remove from watchlist"
    : selectedList
      ? "Add to watchlist"
      : "Create a watchlist first";
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
function setPaperControlMessage(message, state = "ok") {
  elements["paper-control-message"].textContent = message;
  elements["paper-control-message"].dataset.state = state;
}
async function paperControlRequest(path, body) {
  if (!mutationToken) {
    setPaperControlMessage("Enable changes with the session mutation token first.", "error");
    return;
  }
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mutationToken}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(
        response.status === 409
          ? "Durable paper state changed. Controls reloaded."
          : (payload.error ?? "Paper control failed."),
      );
    }
    setPaperControlMessage("Paper-only request accepted.");
  } catch (error) {
    setPaperControlMessage(
      error instanceof Error ? error.message : "Paper control failed.",
      "error",
    );
  } finally {
    await refreshDetails().catch(() => undefined);
    await refresh().catch(() => undefined);
  }
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
applyPreferences();
void refreshWatchlists().catch(() =>
  setWatchlistMessage("Persistent watchlists unavailable.", "error"),
);
void refreshConfigurations().catch(() =>
  setConfigurationMessage("Trading configurations unavailable.", "error"),
);
void refresh();
scheduleRefresh();
elements["refresh-now"].addEventListener("click", () => void refresh());
elements["refresh-rate"].addEventListener("change", scheduleRefresh);
elements["menu-toggle"].addEventListener("click", () => {
  const open = document.body.dataset.menu !== "open";
  document.body.dataset.menu = open ? "open" : "closed";
  elements["menu-toggle"].ariaExpanded = String(open);
});
elements["sidebar-backdrop"].addEventListener("click", closeMenu);
document
  .querySelectorAll("#sidebar nav a")
  .forEach((link) => link.addEventListener("click", closeMenu));
elements["sidebar-collapse"].addEventListener("click", () => {
  preferences.sidebar = preferences.sidebar === "collapsed" ? "expanded" : "collapsed";
  savePreferences();
});
elements["preferences-open"].addEventListener("click", () =>
  elements["preferences-dialog"].showModal(),
);
elements["preferences-close"].addEventListener("click", () =>
  elements["preferences-dialog"].close(),
);
elements["preferences-done"].addEventListener("click", () =>
  elements["preferences-dialog"].close(),
);
elements["preferences-reset"].addEventListener("click", () => {
  preferences = defaultPreferences();
  savePreferences();
  setPreferenceMessage("Default preferences restored.");
});
elements["theme-preference"].addEventListener("change", () => {
  preferences.theme = elements["theme-preference"].value;
  savePreferences();
});
for (const [id, key, on, off] of [
  ["high-contrast", "contrast", "high", "standard"],
  ["large-text", "text", "large", "standard"],
  ["reduce-motion", "motion", "reduced", "full"],
]) {
  elements[id].addEventListener("change", () => {
    preferences[key] = elements[id].checked ? on : off;
    savePreferences();
  });
}
elements["preferences-export"].addEventListener("click", exportPreferences);
elements["preferences-import"].addEventListener(
  "change",
  () => void importPreferences(elements["preferences-import"].files?.[0]),
);
elements["panel-preferences"].addEventListener("change", (event) => {
  if (!(event.target instanceof HTMLInputElement)) return;
  const id = event.target.dataset.panelVisibility;
  if (!id || id === "overview") return;
  preferences.hiddenPanels = event.target.checked
    ? preferences.hiddenPanels.filter((panel) => panel !== id)
    : [...new Set([...preferences.hiddenPanels, id])];
  savePreferences();
});
elements["panel-preferences"].addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLButtonElement)) return;
  const id = event.target.dataset.panelId;
  const direction = event.target.dataset.panelMove;
  const index = preferences.panelOrder.indexOf(id);
  const destination = direction === "up" ? index - 1 : direction === "down" ? index + 1 : index;
  if (index < 0 || destination < 0 || destination >= preferences.panelOrder.length) return;
  const order = [...preferences.panelOrder];
  [order[index], order[destination]] = [order[destination], order[index]];
  preferences.panelOrder = order;
  savePreferences();
});
document.querySelectorAll('input[name="density"]').forEach((control) =>
  control.addEventListener("change", () => {
    if (control instanceof HTMLInputElement && control.checked) {
      preferences.density = control.value;
      savePreferences();
    }
  }),
);
elements["token-search"].addEventListener("input", renderDetails);
elements["side-filter"].addEventListener("change", renderDetails);
elements["clear-filters"].addEventListener("click", () => {
  elements["token-search"].value = "";
  elements["side-filter"].value = "all";
  renderDetails();
});
elements["close-token"].addEventListener("click", () => elements["token-dialog"].close());
elements["toggle-watchlist"].addEventListener("click", () => {
  const selected = activeWatchlist();
  if (!selectedToken || !selected) return;
  const contains = selected.tokens.includes(selectedToken);
  const path = contains
    ? `/api/watchlists/${selected.id}/tokens/${selectedToken}`
    : `/api/watchlists/${selected.id}/tokens`;
  void mutateWatchlist(path, contains ? "DELETE" : "POST", {
    expectedVersion: selected.version,
    ...(contains ? {} : { mint: selectedToken }),
  }).then((result) => {
    if (result)
      elements["toggle-watchlist"].textContent = contains
        ? "Add to watchlist"
        : "Remove from watchlist";
  });
});
elements["watchlist-connect"].addEventListener("click", () => {
  mutationToken = elements["watchlist-token"].value;
  elements["watchlist-token"].value = "";
  renderWatchlistControls();
  renderConfigurations();
  renderDetails();
  setWatchlistMessage(
    mutationToken ? "Changes enabled for this page session." : "Enter a mutation token.",
    mutationToken ? "ok" : "error",
  );
});
elements["configuration-select"].addEventListener("change", () => {
  activeConfigurationId = elements["configuration-select"].value;
  renderConfigurations();
});
elements["configuration-new"].addEventListener("click", () => {
  activeConfigurationId = "";
  renderConfigurations();
  elements["configuration-name"].focus();
});
elements["configuration-form"].addEventListener("submit", (event) => {
  event.preventDefault();
  const selected = activeConfiguration();
  const values = configurationValues();
  if (values.maximumPositionEquityBps > values.maximumOpenExposureBps) {
    setConfigurationMessage("Position equity cannot exceed open exposure.", "error");
    return;
  }
  void mutateConfiguration(
    selected ? `/api/trading-configurations/${selected.id}` : "/api/trading-configurations",
    selected ? "PUT" : "POST",
    { ...values, ...(selected ? { expectedVersion: selected.version } : {}) },
  );
});
elements["configuration-delete"].addEventListener("click", () => {
  const selected = activeConfiguration();
  if (!selected || prompt(`Type ${selected.name} to delete this draft`) !== selected.name) return;
  void mutateConfiguration(`/api/trading-configurations/${selected.id}`, "DELETE", {
    expectedVersion: selected.version,
    confirmedName: selected.name,
  });
});
elements["watchlist-select"].addEventListener("change", () => {
  activeWatchlistId = elements["watchlist-select"].value;
  renderWatchlistControls();
  renderWatchlist();
});
elements["watchlist-create"].addEventListener("click", () => {
  const name = prompt("New watchlist name");
  if (name) void mutateWatchlist("/api/watchlists", "POST", { name });
});
elements["watchlist-rename"].addEventListener("click", () => {
  const selected = activeWatchlist();
  if (!selected) return;
  const name = prompt("Rename watchlist", selected.name);
  if (name)
    void mutateWatchlist(`/api/watchlists/${selected.id}`, "PATCH", {
      expectedVersion: selected.version,
      name,
    });
});
elements["watchlist-delete"].addEventListener("click", () => {
  const selected = activeWatchlist();
  if (!selected || prompt(`Type ${selected.name} to delete this watchlist`) !== selected.name)
    return;
  void mutateWatchlist(`/api/watchlists/${selected.id}`, "DELETE", {
    expectedVersion: selected.version,
    confirmedName: selected.name,
  }).then((result) => {
    if (result === null) void refreshWatchlists();
  });
});
elements["watchlist-import"].addEventListener("click", async () => {
  if (legacyWatchlist.size === 0) return;
  let selected = activeWatchlist();
  if (!selected) {
    const created = await mutateWatchlist("/api/watchlists", "POST", {
      name: "Imported watchlist",
    });
    selected = created?.watchlist ?? null;
  }
  if (!selected) return;
  for (const mint of [...legacyWatchlist].sort()) {
    if (selected.tokens.includes(mint)) continue;
    const result = await mutateWatchlist(`/api/watchlists/${selected.id}/tokens`, "POST", {
      expectedVersion: selected.version,
      mint,
    });
    if (!result) return;
    selected = result.watchlist;
  }
  legacyWatchlist.clear();
  saveWatchlist();
  renderWatchlistControls();
  setWatchlistMessage("Local tokens imported and local copy cleared.");
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
    const selected = activeWatchlist();
    if (selected)
      void mutateWatchlist(`/api/watchlists/${selected.id}/tokens/${remove.title}`, "DELETE", {
        expectedVersion: selected.version,
      });
    return;
  }
  const control = event.target.closest("[data-paper-action]");
  if (control?.dataset.paperAction === "cancel-entry") {
    const signalId = control.dataset.signalId;
    const version = Number(control.dataset.version);
    if (!signalId || prompt(`Type ${signalId} to cancel this paper entry`) !== signalId) return;
    void paperControlRequest(`/api/paper/orders/${signalId}/cancel`, {
      expectedVersion: version,
      confirmedSignalId: signalId,
    });
    return;
  }
  if (control?.dataset.paperAction === "close-position") {
    const mint = control.dataset.mint;
    const amountRaw = control.dataset.amountRaw;
    if (!mint || !amountRaw || prompt(`Type ${mint} to request a full paper close`) !== mint)
      return;
    void paperControlRequest(`/api/paper/positions/${mint}/close`, {
      confirmedMint: mint,
      expectedOpenAmountRaw: amountRaw,
    });
    return;
  }
  const target = event.target.closest("[data-token-mint]");
  if (target?.dataset.tokenMint) void openToken(target.dataset.tokenMint);
});
