const lamportsPerSol = 1_000_000_000n;
const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");
function installActionFeedback() {
  const notice = document.createElement("div");
  notice.className = "action-feedback";
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  notice.hidden = true;
  document.body.append(notice);
  const original = window.fetch.bind(window);
  let timer;
  const show = (message, state, persist = false) => {
    clearTimeout(timer);
    notice.textContent = message;
    notice.dataset.state = state;
    notice.hidden = false;
    if (!persist)
      timer = setTimeout(
        () => {
          notice.hidden = true;
        },
        state === "error" ? 8000 : 4500,
      );
  };
  window.fetch = async (input, options = {}) => {
    const method = String(
      options.method || (input instanceof Request ? input.method : "GET"),
    ).toUpperCase();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return original(input, options);
    show(method === "DELETE" ? "Deleting…" : "Saving…", "working", true);
    try {
      const response = await original(input, options);
      show(
        response.ok
          ? method === "DELETE"
            ? "Deleted successfully."
            : "Action completed successfully."
          : "The action did not complete. Review the message on this page and try again.",
        response.ok ? "success" : "error",
      );
      return response;
    } catch (error) {
      show("The action did not complete. Check the connection and try again.", "error");
      throw error;
    }
  };
}
installActionFeedback();
const ids = [
  "status",
  "status-label",
  "page-title",
  "page-description",
  "equity",
  "equity-change",
  "cash",
  "open-cost",
  "open-positions",
  "pnl",
  "fills",
  "entries",
  "positions-due",
  "entry-lock-state",
  "entry-lock-reason",
  "approval-pending",
  "approval-approved",
  "approval-expiring",
  "entry-queued",
  "entry-submitted",
  "reconciliation-backlog",
  "failed-work",
  "telegram-state",
  "operator-action",
  "integrity-title",
  "integrity-copy",
  "errors",
  "wallet",
  "observed",
  "database-health",
  "execution-mode",
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
  "performance-net",
  "performance-net-context",
  "performance-return",
  "performance-closed",
  "performance-trade-context",
  "performance-win-rate",
  "performance-win-context",
  "performance-average",
  "performance-drawdown",
  "strategy-performance-rows",
  "exit-reason-rows",
  "closed-trade-rows",
  "overview-active-profiles",
  "overview-assessed",
  "overview-qualified",
  "overview-completed",
  "overview-winners",
  "overview-open",
  "overview-best-strategy",
  "overview-last-trade",
  "overview-current-position",
  "overview-current-position-row",
  "pipeline-assessed",
  "pipeline-qualified",
  "pipeline-qualification-rate",
  "pipeline-buys",
  "pipeline-completed",
  "pipeline-quote-failures",
  "pipeline-interpretation",
  "strategy-funnel-rows",
  "positions-history-toolbar",
  "alert-count",
  "alert-rows",
  "pipeline-state",
  "pipeline-summary",
  "pipeline-work",
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
  "profile-list",
  "profile-active-count",
  "profile-allocation-summary",
  "benchmark-list",
  "benchmark-active-count",
  "benchmark-message",
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
  "app-back",
  "return-launcher",
  "action-dialog",
  "action-dialog-form",
  "action-dialog-close",
  "action-dialog-title",
  "action-dialog-message",
  "action-dialog-input-label",
  "action-dialog-label",
  "action-dialog-input",
  "action-dialog-cancel",
  "action-dialog-confirm",
];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
let detailSnapshot = { positions: [], pendingEntries: [], fills: [], performance: [], events: [] };
let latestPerformance = null;
let performancePoints = [];
let selectedRange = "7d";
let refreshTimer;
const connectionEvents = [];
const watchlistKey = "memecoined.paper.watchlist.v1";
const preferencesKey = "memecoined.paper.preferences.v1";
const configurationDraftKey = "memecoined.paper.configuration-draft.v1";
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
let tradingProfiles = [];
let activeConfigurationId = "";
let preferences = loadPreferences();
const sortState = {
  positions: { key: "opened_at", kind: "date", direction: "desc" },
  fills: { key: "filled_at", kind: "date", direction: "desc" },
  performance: { key: "realized_at", kind: "date", direction: "desc" },
  events: { key: "evaluated_at", kind: "date", direction: "desc" },
};
const pageSize = 50;
const tablePages = new Map();
const tableRenderers = new Map();
let actionDialogResolve = null;
let configurationDirty = false;

function requestAction({
  title,
  message,
  label = "Value",
  value = "",
  confirmLabel = "Continue",
  input = true,
}) {
  elements["action-dialog-title"].textContent = title;
  elements["action-dialog-message"].textContent = message;
  elements["action-dialog-label"].textContent = label;
  elements["action-dialog-input"].value = value;
  elements["action-dialog-input-label"].hidden = !input;
  elements["action-dialog-confirm"].textContent = confirmLabel;
  elements["action-dialog"].showModal();
  if (input) elements["action-dialog-input"].focus();
  return new Promise((resolve) => {
    actionDialogResolve = resolve;
  });
}
function finishAction(value) {
  elements["action-dialog"].close();
  const resolve = actionDialogResolve;
  actionDialogResolve = null;
  resolve?.(value);
}
function resetTablePages() {
  for (const key of tablePages.keys()) tablePages.set(key, 1);
}
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
    theme: ["system", "dark", "light"].includes(value.theme) ? value.theme : "dark",
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
    theme: "dark",
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
  const currentPage = document.body.dataset.page ?? "overview";
  for (const id of preferences.panelOrder) {
    const panel = main.querySelector(`[data-dashboard-panel="${id}"]`);
    if (!(panel instanceof HTMLElement)) continue;
    // Panel visibility is an Overview preference. A saved dashboard choice must
    // never make the corresponding task-level page blank.
    panel.hidden = currentPage === "overview" && preferences.hiddenPanels.includes(id);
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
function setBenchmarkMessage(message, state = "ok") {
  elements["benchmark-message"].textContent = message;
  elements["benchmark-message"].dataset.state = state;
}
function percentFromBps(value) {
  return `${(Number(value) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}
function profileModeLabel(mode) {
  return (
    {
      observe: "Observe only",
      recommend: "Recommend trades",
      automatic_paper: "Automatic paper trading",
    }[mode] ?? mode
  );
}
function renderTradingProfiles() {
  const timsysProfiles = tradingProfiles.filter((profile) => profile.group !== "benchmark");
  const benchmarkProfiles = tradingProfiles.filter((profile) => profile.group === "benchmark");
  const enabled = timsysProfiles.filter((profile) => profile.enabled);
  const allocated = enabled.reduce((sum, profile) => sum + profile.allocationBps, 0);
  elements["profile-active-count"].textContent = `${enabled.length} active`;
  elements["profile-allocation-summary"].textContent =
    `${percentFromBps(allocated)} of paper funds allocated`;
  elements["profile-list"].replaceChildren();
  elements["benchmark-list"].replaceChildren();
  elements["benchmark-active-count"].textContent = `${benchmarkProfiles.filter((profile) => profile.enabled).length} active`;
  for (const profile of tradingProfiles) {
    const card = document.createElement("article");
    card.className = "profile-card";
    card.dataset.enabled = String(profile.enabled);
    card.dataset.profileId = profile.id;
    const heading = document.createElement("div");
    heading.className = "profile-card-heading";
    const titleGroup = document.createElement("div");
    const state = document.createElement("span");
    state.className = "profile-state";
    state.textContent = profile.enabled ? "ACTIVE" : "OFF";
    const title = document.createElement("h3");
    title.textContent = profile.name;
    titleGroup.append(state, title);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.textContent = profile.enabled ? "Stop profile" : "Start profile";
    toggle.disabled = !mutationToken;
    const summary = document.createElement("p");
    summary.textContent = profile.summary;
    const approach = document.createElement("p");
    approach.className = "profile-approach";
    approach.textContent = profile.approach;
    const evidence = document.createElement("p");
    evidence.className = "profile-approach";
    evidence.textContent = `${profile.evidenceStatus === "awaiting_data" ? "Waiting for evidence: " : "Evidence ready: "}${profile.evidenceMessage || "Uses the candidate evidence currently collected."}`;
    const decisionModel = document.createElement("p");
    decisionModel.className = "profile-approach";
    decisionModel.textContent = `Entry rule: ${profile.decisionModel || "Candidate score, safety gates and the profile’s stated evidence rules."}`;
    const controls = document.createElement("div");
    controls.className = "profile-controls";
    const mode = document.createElement("label");
    mode.innerHTML = "<span>What this profile may do</span>";
    const modeSelect = document.createElement("select");
    for (const value of ["observe", "recommend", "automatic_paper"]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = profileModeLabel(value);
      option.disabled = value === "automatic_paper" && profile.evidenceStatus === "awaiting_data";
      option.selected = profile.mode === value;
      modeSelect.append(option);
    }
    modeSelect.disabled = !mutationToken;
    mode.append(modeSelect);
    const allocation = document.createElement("label");
    allocation.innerHTML = "<span>Share of paper funds</span>";
    const allocationInput = document.createElement("input");
    allocationInput.type = "number";
    allocationInput.min = "0";
    allocationInput.max = "100";
    allocationInput.step = "0.5";
    allocationInput.value = String(profile.allocationBps / 100);
    allocationInput.disabled = !mutationToken;
    allocation.append(allocationInput);
    if (profile.group === "benchmark") {
      allocation.querySelector("span").textContent = "Comparison capital";
      allocationInput.value = "100";
      allocationInput.disabled = true;
    }
    const facts = document.createElement("dl");
    facts.className = "profile-facts";
    const performance = profile.performance;
    const assessed = Number(performance?.candidates_evaluated ?? 0);
    const uniqueTokens = Number(performance?.unique_tokens_evaluated ?? 0);
    const qualified = Number(performance?.candidates_qualified ?? 0);
    const result = BigInt(performance?.current_engine_net_pnl_raw ?? "0");
    const initial = BigInt(performance?.initial_cash_raw ?? "0");
    const calibration = performance?.latest_signal?.adaptiveCalibration;
    const calibrationFacts = calibration
      ? `<div><dt>Current token range</dt><dd>${String(calibration.regime).replaceAll("_", " ")} · ${Number(calibration.confidencePercentage)}% confidence</dd></div><div><dt>Adaptive target</dt><dd>${Number(calibration.targetBps) / 100}%</dd></div><div><dt>Adaptive loss limit</dt><dd>${Number(calibration.hardStopBps) / 100}%</dd></div><div><dt>Profit protection</dt><dd>Starts at ${Number(calibration.trailingActivationBps) / 100}%, trails by ${Number(calibration.trailingStopBps) / 100}%</dd></div><div><dt>Adaptive time limit</dt><dd>${Number(calibration.maximumHoldingMinutes)} minutes</dd></div><div><dt>Maximum round-trip cost</dt><dd>${Number(calibration.maximumRoundTripCostBps) / 100}%</dd></div><div><dt>Why</dt><dd>${escapeHtml(calibration.reason)}</dd></div>`
      : "";
    const temporalFacts = Number(performance?.market_observations ?? 0) > 0
      ? `<div><dt>Live price samples</dt><dd>${Number(performance.market_observations).toLocaleString()}</dd></div><div><dt>Tokens being followed</dt><dd>${Number(performance.monitored_tokens ?? 0).toLocaleString()}</dd></div><div><dt>Tokens ready for pattern detection</dt><dd>${Number(performance.history_ready_tokens ?? 0).toLocaleString()}</dd></div><div><dt>Pattern checks completed</dt><dd>${Number(performance.short_horizon_signals ?? 0).toLocaleString()}</dd></div><div><dt>Adaptive calibrations</dt><dd>${Number(performance.adaptive_calibrations ?? 0).toLocaleString()}</dd></div><div><dt>Tradeable calibrated ranges</dt><dd>${Number(performance.adaptive_tradeable ?? 0).toLocaleString()}</dd></div><div><dt>Waiting for this strategy’s entry shape</dt><dd>${Number(performance.adaptive_pattern_waiting ?? 0).toLocaleString()}</dd></div><div><dt>Signals passing all gates</dt><dd>${Number(performance.short_horizon_qualified ?? 0).toLocaleString()}</dd></div>${performance.latest_signal ? `<div><dt>Latest detected pattern</dt><dd>${String(performance.latest_signal.pattern ?? "none").replaceAll("_", " ")}</dd></div><div><dt>Latest short movement</dt><dd>${Number(performance.latest_signal.shortMoveBps ?? 0) / 100}%</dd></div><div><dt>Five-minute volume change</dt><dd>${performance.latest_signal.volumeChangeBps == null ? "Unavailable" : `${Number(performance.latest_signal.volumeChangeBps) / 100}%`}</dd></div><div><dt>Liquidity change</dt><dd>${performance.latest_signal.liquidityChangeBps == null ? "Unavailable" : `${Number(performance.latest_signal.liquidityChangeBps) / 100}%`}</dd></div><div><dt>Buyer share</dt><dd>${performance.latest_signal.buyPressureBps == null ? "Unavailable" : `${Number(performance.latest_signal.buyPressureBps) / 100}%`}</dd></div>${calibrationFacts}` : ""}`
      : "";
    facts.innerHTML = `<div><dt>Risk per trade</dt><dd>${percentFromBps(profile.riskPerTradeBps)}</dd></div><div><dt>Maximum positions</dt><dd>${profile.maximumConcurrentPositions}</dd></div><div><dt>Typical time limit</dt><dd>${profile.maximumHoldingMinutes < 1440 ? `${profile.maximumHoldingMinutes} minutes` : `${profile.maximumHoldingMinutes / 1440} day(s)`}</dd></div><div><dt>Current-engine assessment runs</dt><dd>${assessed.toLocaleString()}</dd></div><div><dt>Different tokens assessed</dt><dd>${uniqueTokens.toLocaleString()}</dd></div><div><dt>Currently qualified</dt><dd>${qualified.toLocaleString()}</dd></div>${temporalFacts}<div><dt>Current-engine buy and sell fills</dt><dd>${performance?.fills ?? 0}</dd></div><div><dt>Entry attempts waiting</dt><dd>${performance?.entries_pending ?? 0}</dd></div><div><dt>Entries rejected by quote cost</dt><dd>${performance?.entries_failed ?? 0}</dd></div><div><dt>Current-engine net result</dt><dd class="${result >= 0n ? "positive" : "negative"}">${performance ? signedSol(result) : "Waiting for first cycle"}</dd></div><div><dt>Return on assigned funds</dt><dd class="${result >= 0n ? "positive" : "negative"}">${performance ? percentage(result, initial, 2) : "—"}</dd></div><div><dt>Positions open now</dt><dd>${performance?.open_positions ?? 0}</dd></div><div><dt>Archived fills from older engines</dt><dd>${Math.max(0, Number(performance?.lifetime_fills ?? 0) - Number(performance?.fills ?? 0)).toLocaleString()}</dd></div>`;
    const save = async (nextEnabled = profile.enabled) => {
      const allocationBps = profile.group === "benchmark" ? 10_000 : Math.round(Number(allocationInput.value) * 100);
      if (!Number.isSafeInteger(allocationBps) || allocationBps < 0 || allocationBps > 10000) {
        const message = "Enter a paper-fund share between 0% and 100%.";
        (profile.group === "benchmark" ? setBenchmarkMessage : setConfigurationMessage)(message, "error");
        actionMessage.textContent = message;
        actionMessage.dataset.state = "error";
        return;
      }
      if (nextEnabled && modeSelect.value === "automatic_paper" && allocationBps === 0) {
        const message = "Choose a share of paper funds before starting automatic paper trading.";
        (profile.group === "benchmark" ? setBenchmarkMessage : setConfigurationMessage)(message, "error");
        actionMessage.textContent = message;
        actionMessage.dataset.state = "error";
        return;
      }
      toggle.disabled = true;
      modeSelect.disabled = true;
      allocationInput.disabled = true;
      actionMessage.textContent = nextEnabled ? "Starting profile…" : "Stopping profile…";
      actionMessage.dataset.state = "working";
      try {
        const response = await fetch(`/api/trading-profiles/${profile.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${mutationToken}` },
          body: JSON.stringify({
            enabled: nextEnabled,
            mode: modeSelect.value,
            allocationBps,
            expectedVersion: profile.version,
          }),
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          if (response.status === 409 && error.error === "profile_allocation_exceeded")
            throw new Error(
              "Active profiles cannot allocate more than 100% of the paper portfolio.",
            );
          if (response.status === 409 && error.error === "profile_evidence_unavailable")
            throw new Error(error.message || "This profile is waiting for required evidence.");
          if (response.status === 409 && error.error === "profile_allocation_invalid")
            throw new Error(error.message || "Review this profile’s paper-fund share.");
          throw new Error(
            response.status === 409
              ? "This profile changed. Current settings were reloaded."
              : "The profile setting was not saved.",
          );
        }
        await refreshTradingProfiles();
        const message = `${profile.name} ${nextEnabled ? "started" : "stopped"} in ${profileModeLabel(modeSelect.value).toLowerCase()} mode.`;
        (profile.group === "benchmark" ? setBenchmarkMessage : setConfigurationMessage)(message);
        const currentMessage = document.querySelector(
          `[data-profile-id="${profile.id}"] .profile-action-message`,
        );
        if (currentMessage) {
          currentMessage.textContent = message;
          currentMessage.dataset.state = "success";
        }
      } catch (error) {
        await refreshTradingProfiles().catch(() => undefined);
        const message = error instanceof Error ? error.message : "The profile setting was not saved.";
        (profile.group === "benchmark" ? setBenchmarkMessage : setConfigurationMessage)(message, "error");
        const currentMessage = document.querySelector(
          `[data-profile-id="${profile.id}"] .profile-action-message`,
        );
        if (currentMessage) {
          currentMessage.textContent = message;
          currentMessage.dataset.state = "error";
        }
      }
    };
    toggle.addEventListener("click", () => void save(!profile.enabled));
    modeSelect.addEventListener("change", () => {
      if (profile.enabled) void save(true);
    });
    allocationInput.addEventListener("change", () => {
      if (profile.enabled) void save(true);
    });
    heading.append(titleGroup, toggle);
    controls.append(mode, allocation);
    const actionMessage = document.createElement("p");
    actionMessage.className = "profile-action-message";
    actionMessage.setAttribute("role", "status");
    actionMessage.setAttribute("aria-live", "polite");
    card.append(heading, summary, approach, decisionModel, evidence, controls, facts, actionMessage);
    elements[profile.group === "benchmark" ? "benchmark-list" : "profile-list"].append(card);
  }
}
async function refreshTradingProfiles() {
  const response = await fetch("/api/trading-profiles", { cache: "no-store" });
  if (!response.ok) throw new Error("Trading profiles unavailable.");
  const result = await response.json();
  tradingProfiles = result.profiles;
  if (result.policy?.operatorAccess === "desktop_session" && !mutationToken) {
    mutationToken = "desktop-session";
    document.querySelector(".operator-access")?.setAttribute("hidden", "");
    renderWatchlistControls();
    renderConfigurations();
    renderDetails();
  }
  renderTradingProfiles();
  renderPerformanceInsights();
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
  let localDraft = {};
  if (!selected) {
    try {
      localDraft = JSON.parse(localStorage.getItem(configurationDraftKey) ?? "{}");
    } catch {
      localDraft = {};
    }
  }
  const values = selected ?? localDraft;
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
      configurationDirty = false;
      try {
        localStorage.removeItem(configurationDraftKey);
      } catch {
        /* optional browser draft */
      }
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
    configurationDirty = false;
    try {
      localStorage.removeItem(configurationDraftKey);
    } catch {
      /* optional browser draft */
    }
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
  tableRenderers.set(target.id, () => renderRows(target, records, cells, empty));
  target.replaceChildren();
  const key = target.id;
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const page = Math.min(Math.max(1, tablePages.get(key) ?? 1), pageCount);
  tablePages.set(key, page);
  const pageRecords = records.slice((page - 1) * pageSize, page * pageSize);
  const table = target.closest("table");
  const heading = table?.querySelector("thead tr");
  if (heading && !heading.querySelector("[data-row-number-heading]")) {
    const numberHeading = document.createElement("th");
    numberHeading.dataset.rowNumberHeading = "true";
    numberHeading.textContent = "#";
    heading.prepend(numberHeading);
  }
  if (records.length === 0) {
    const row = target.insertRow();
    const cell = row.insertCell();
    cell.colSpan = cells.length + 1;
    cell.className = "empty";
    cell.textContent = empty;
    renderPagination(target, 1, 1, 0);
    return;
  }
  for (const [index, record] of pageRecords.entries()) {
    const row = target.insertRow();
    const number = row.insertCell();
    number.className = "row-number";
    number.textContent = String((page - 1) * pageSize + index + 1);
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
  renderPagination(target, page, pageCount, records.length);
}
function renderPagination(target, page, pageCount, total) {
  const container = target.closest(".table-scroll");
  if (!container) return;
  let navigation = container.nextElementSibling;
  if (!navigation?.classList.contains("table-pagination")) {
    navigation = document.createElement("nav");
    navigation.className = "table-pagination";
    navigation.setAttribute("aria-label", "Table pagination");
    container.after(navigation);
  }
  navigation.replaceChildren();
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const summary = document.createElement("span");
  summary.textContent =
    total > pageSize
      ? `Showing ${first}–${last} of ${total}`
      : `${total} record${total === 1 ? "" : "s"}`;
  navigation.append(summary);
  if (pageCount <= 1) return;
  const controls = document.createElement("div");
  for (const [label, destination, disabled] of [
    ["Previous", page - 1, page === 1],
    [`Page ${page} of ${pageCount}`, page, true],
    ["Next", page + 1, page === pageCount],
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.disabled = disabled;
    if (!disabled)
      button.addEventListener("click", () => {
        tablePages.set(target.id, destination);
        tableRenderers.get(target.id)?.();
      });
    controls.append(button);
  }
  navigation.append(controls);
}
function amount(raw) {
  const value = String(raw ?? "0");
  return { text: BigInt(value).toLocaleString(), title: value };
}
function profileName(profileId) {
  if (!profileId) return "Core workflow";
  return tradingProfiles.find((profile) => profile.id === profileId)?.name ?? String(profileId);
}
function signedSol(raw) {
  const value = BigInt(raw);
  return `${value > 0n ? "+" : ""}${sol(value.toString())}`;
}
function percentage(numerator, denominator, digits = 1) {
  if (denominator === 0n) return "—";
  return `${(Number(numerator * 10_000n / denominator) / 100).toFixed(digits)}%`;
}
function tradeReturn(trade, digits = 2) {
  if (!trade || trade.spent <= 0n) return "—";
  const value = percentage(trade.pnl, trade.spent, digits);
  return trade.pnl > 0n ? `+${value}` : value;
}
function selectedRangeStart() {
  const milliseconds = { "24h": 86_400_000, "7d": 604_800_000, "30d": 2_592_000_000 }[selectedRange];
  return milliseconds ? Date.now() - milliseconds : Number.NEGATIVE_INFINITY;
}
function completedTrades(applyRange = true) {
  const entries = new Map();
  const trades = [];
  const fills = [...detailSnapshot.fills].sort(
    (left, right) => Date.parse(left.filled_at) - Date.parse(right.filled_at),
  );
  for (const fill of fills) {
    if (fill.profile_id && !String(fill.engine_version || "").startsWith("temporal-v")) continue;
    const key = `${fill.profile_id ?? "core"}:${fill.token_mint}`;
    if (fill.side === "buy") {
      entries.set(key, fill);
      continue;
    }
    const entry = entries.get(key);
    if (!entry || fill.side !== "sell") continue;
    const spent = BigInt(entry.settlement_amount_raw);
    const received = BigInt(fill.settlement_amount_raw);
    const pnl = received - spent - BigInt(entry.execution_fee_raw ?? "0") - BigInt(fill.execution_fee_raw ?? "0");
    trades.push({ entry, exit: fill, spent, received, pnl });
    entries.delete(key);
  }
  return applyRange
    ? trades.filter((trade) => Date.parse(trade.exit.filled_at) >= selectedRangeStart())
    : trades;
}
function renderOperationalEvidence() {
  const active = tradingProfiles.filter((profile) => profile.enabled);
  const assessed = tradingProfiles.reduce(
    (sum, profile) => sum + Number(profile.performance?.candidates_evaluated ?? 0),
    0,
  );
  const qualified = tradingProfiles.reduce(
    (sum, profile) => sum + Number(profile.performance?.candidates_qualified ?? 0),
    0,
  );
  const quoteFailures = tradingProfiles.reduce(
    (sum, profile) => sum + Number(profile.performance?.entries_failed ?? 0),
    0,
  );
  const allTrades = completedTrades(false);
  const buys = detailSnapshot.fills.filter((fill) => fill.side === "buy").length;
  const winners = allTrades.filter((trade) => trade.pnl > 0n).length;
  const best = [...tradingProfiles]
    .filter((profile) => Number(profile.performance?.fills ?? 0) > 0)
    .sort((left, right) => {
      const a = BigInt(left.performance?.current_engine_net_pnl_raw ?? "0");
      const b = BigInt(right.performance?.current_engine_net_pnl_raw ?? "0");
      return a === b ? 0 : a > b ? -1 : 1;
    })[0];
  const lastFill = [...detailSnapshot.fills].sort(
    (left, right) => Date.parse(right.filled_at) - Date.parse(left.filled_at),
  )[0];
  const current = detailSnapshot.positions[0];

  elements["overview-active-profiles"].textContent = String(active.length);
  elements["overview-assessed"].textContent = assessed.toLocaleString();
  elements["overview-qualified"].textContent = qualified.toLocaleString();
  elements["overview-completed"].textContent = allTrades.length.toLocaleString();
  elements["overview-winners"].textContent = winners.toLocaleString();
  elements["overview-open"].textContent = allTrades.length
    ? `${((winners / allTrades.length) * 100).toFixed(1)}%`
    : "—";
  elements["overview-best-strategy"].textContent = best
    ? `${BigInt(best.performance.current_engine_net_pnl_raw ?? "0") > 0n ? "Best gain" : "Smallest loss"}: ${best.name} · ${signedSol(best.performance.current_engine_net_pnl_raw ?? "0")}`
    : "No strategy has completed a trade";
  elements["overview-last-trade"].textContent = lastFill
    ? `${profileName(lastFill.profile_id)} ${lastFill.side.toUpperCase()} ${short(lastFill.token_mint)} for ${sol(lastFill.settlement_amount_raw)} · ${time(lastFill.filled_at)}`
    : "No trades recorded";
  elements["overview-current-position"].textContent = current
    ? `${profileName(current.profile_id)} holds ${short(current.token_mint)} · ${sol(current.cost_raw)} invested${current.current_value_raw ? ` · ${sol(current.current_value_raw)} now` : ""}`
    : "No position is open";
  elements["overview-current-position-row"].hidden = !current;

  elements["pipeline-assessed"].textContent = assessed.toLocaleString();
  elements["pipeline-qualified"].textContent = qualified.toLocaleString();
  elements["pipeline-qualification-rate"].textContent = assessed
    ? `${((qualified / assessed) * 100).toFixed(3)}%`
    : "—";
  elements["pipeline-buys"].textContent = buys.toLocaleString();
  elements["pipeline-completed"].textContent = allTrades.length.toLocaleString();
  elements["pipeline-quote-failures"].textContent = quoteFailures.toLocaleString();
  elements["pipeline-interpretation"].textContent = !assessed
    ? "No candidate assessments have been recorded yet."
    : !qualified
      ? "Candidates are being assessed, but none currently pass a strategy’s entry rules."
      : !buys
        ? `${qualified.toLocaleString()} strategy qualification${qualified === 1 ? " has" : "s have"} been recorded, but none has produced a buy fill. Review quote failures and entry controls.`
        : `${qualified.toLocaleString()} qualifications produced ${buys.toLocaleString()} buy fill${buys === 1 ? "" : "s"} and ${allTrades.length.toLocaleString()} completed position${allTrades.length === 1 ? "" : "s"}.`;
}
function renderPerformanceInsights() {
  if (!latestPerformance) return;
  const initial = BigInt(latestPerformance.initialCashRaw);
  const equity = BigInt(latestPerformance.cashRaw) + BigInt(latestPerformance.openValueRaw);
  const net = equity - initial;
  elements["performance-net"].textContent = signedSol(net);
  elements["performance-return"].textContent = percentage(net, initial, 2);
  pnlClass(elements["performance-net"], net.toString());
  pnlClass(elements["performance-return"], net.toString());

  const trades = completedTrades();
  const wins = trades.filter((trade) => trade.pnl > 0n).length;
  const netClosed = trades.reduce((sum, trade) => sum + trade.pnl, 0n);
  elements["performance-closed"].textContent = String(trades.length);
  elements["performance-win-rate"].textContent = trades.length
    ? `${((wins / trades.length) * 100).toFixed(1)}%`
    : "—";
  elements["performance-win-context"].textContent = trades.length
    ? `${wins} won · ${trades.length - wins} did not`
    : "No completed trades in this period";
  const average = trades.length ? netClosed / BigInt(trades.length) : 0n;
  elements["performance-average"].textContent = trades.length ? signedSol(average) : "—";
  pnlClass(elements["performance-average"], average.toString());

  let peak = performancePoints.length ? BigInt(performancePoints[0].bookEquityRaw) : initial;
  let maximumDrawdown = 0n;
  for (const point of performancePoints) {
    const value = BigInt(point.bookEquityRaw);
    if (value > peak) peak = value;
    if (peak - value > maximumDrawdown) maximumDrawdown = peak - value;
  }
  elements["performance-drawdown"].textContent = maximumDrawdown ? sol(maximumDrawdown) : "0 SOL";

  const strategyRows = tradingProfiles
    .filter((profile) => profile.performance?.fills || profile.enabled)
    .sort((left, right) => {
      const a = BigInt(left.performance?.current_engine_net_pnl_raw ?? "0");
      const b = BigInt(right.performance?.current_engine_net_pnl_raw ?? "0");
      return a === b ? 0 : a > b ? -1 : 1;
    });
  renderRows(elements["strategy-performance-rows"], strategyRows, [
    (profile) => ({ text: profile.name }),
    (profile) => ({ text: signedSol(profile.performance?.current_engine_net_pnl_raw ?? "0"), className: BigInt(profile.performance?.current_engine_net_pnl_raw ?? "0") >= 0n ? "positive" : "negative" }),
    (profile) => ({ text: percentage(BigInt(profile.performance?.current_engine_net_pnl_raw ?? "0"), BigInt(profile.performance?.initial_cash_raw ?? "0"), 2) }),
    (profile) => ({ text: String(profile.performance?.fills ?? 0) }),
    (profile) => ({ text: String(profile.performance?.open_positions ?? 0) }),
  ], "No strategy has traded yet");

  const reasons = new Map();
  for (const trade of trades) {
    const reason = trade.exit.reason ?? "not_recorded";
    const current = reasons.get(reason) ?? { count: 0, wins: 0, pnl: 0n };
    current.count += 1;
    current.wins += trade.pnl > 0n ? 1 : 0;
    current.pnl += trade.pnl;
    reasons.set(reason, current);
  }
  renderRows(elements["exit-reason-rows"], [...reasons.entries()], [
    ([reason]) => ({ text: tradeReason(reason) }),
    ([, value]) => ({ text: String(value.count) }),
    ([, value]) => ({ text: String(value.wins) }),
    ([, value]) => ({ text: signedSol(value.pnl), className: value.pnl >= 0n ? "positive" : "negative" }),
  ], "No positions closed in this period");

  renderRows(elements["closed-trade-rows"], [...trades].reverse(), [
    (trade) => ({ text: profileName(trade.exit.profile_id) }),
    (trade) => token(trade.exit),
    (trade) => ({ text: sol(trade.spent) }),
    (trade) => ({ text: sol(trade.received) }),
    (trade) => ({ text: signedSol(trade.pnl), className: trade.pnl >= 0n ? "positive" : "negative" }),
    (trade) => ({ text: percentage(trade.pnl, trade.spent, 1) }),
    (trade) => ({ text: duration(Date.parse(trade.exit.filled_at) - Date.parse(trade.entry.filled_at)) }),
    (trade) => ({ text: tradeReason(trade.exit.reason) }),
  ], "No completed trades in this period");
  renderOperationalEvidence();
}
function duration(milliseconds) {
  const minutes = Math.max(0, Math.round(milliseconds / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
function tradeReason(reason) {
  return {
    profile_entry: "Strategy entry",
    approved_entry: "Approved entry",
    hard_stop: "Loss limit reached",
    profit_target: "Profit target reached",
    trailing_stop: "Trailing protection triggered",
    time_limit: "Maximum holding time reached",
    position_exit: "Position exit",
  }[reason] ?? String(reason ?? "Not recorded").replaceAll("_", " ");
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
    const lastTrade = [...detailSnapshot.fills]
      .filter((item) => item.token_mint === mint)
      .sort((left, right) => Date.parse(right.filled_at) - Date.parse(left.filled_at))[0];
    return {
      token_mint: mint,
      cost_raw: position?.cost_raw ?? "0",
      current_value_raw: position?.current_value_raw ?? null,
      last_trade: lastTrade
        ? `${lastTrade.side.toUpperCase()} ${sol(lastTrade.settlement_amount_raw)} · ${time(lastTrade.filled_at)}`
        : "No recorded trade",
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
      (r) => ({ text: r.current_value_raw === null ? "—" : sol(r.current_value_raw) }),
      (r) => ({ text: r.last_trade }),
      (r) => ({ text: r.status }),
      (r) => ({ text: "Remove", className: "watch-remove", title: r.token_mint }),
    ],
    "No watched tokens",
  );
}
function renderDetails() {
  const positions = sorted(
    filterToken(detailSnapshot.positions).map((position) => ({
      ...position,
      unrealized_raw:
        position.current_value_raw === null || position.current_value_raw === undefined
          ? null
          : (BigInt(position.current_value_raw) - BigInt(position.cost_raw)).toString(),
    })),
    "positions",
  );
  const pendingEntries = filterToken(detailSnapshot.pendingEntries);
  const completed = completedTrades();
  const completedByExit = new Map(completedTrades(false).map((trade) => [trade.exit, trade]));
  const profilePerformance = completed.map((trade) => ({
    token_mint: trade.exit.token_mint,
    proceeds_raw: trade.received.toString(),
    released_cost_raw: trade.spent.toString(),
    realized_pnl_raw: trade.pnl.toString(),
    return_percent: tradeReturn(trade),
    realized_at: trade.exit.filled_at,
  }));
  const performance = sorted(
    filterToken([...detailSnapshot.performance, ...profilePerformance]).map((record) => ({
      ...record,
      return_percent:
        record.return_percent ??
        (BigInt(record.released_cost_raw ?? "0") > 0n
          ? `${BigInt(record.realized_pnl_raw ?? "0") > 0n ? "+" : ""}${percentage(
              BigInt(record.realized_pnl_raw ?? "0"),
              BigInt(record.released_cost_raw),
              2,
            )}`
          : "—"),
    })),
    "performance",
  );
  const events = sorted(filterToken(detailSnapshot.events), "events");
  const fills = sorted(
    filterToken(detailSnapshot.fills).filter(
      (record) =>
        elements["side-filter"].value === "all" || record.side === elements["side-filter"].value,
    ).map((record) => ({
      ...record,
      completed_trade: record.side === "sell" ? completedByExit.get(record) : undefined,
    })),
    "fills",
  );
  const currentPage = document.body.dataset.page;
  const visibleRecords = currentPage === "positions"
    ? positions.length + pendingEntries.length
    : fills.length + performance.length + events.length;
  elements["filter-status"].textContent = visibleRecords
    ? `Showing ${visibleRecords.toLocaleString()} matching record${visibleRecords === 1 ? "" : "s"}`
    : "No matching records";
  elements["positions-history-toolbar"].hidden =
    currentPage === "positions" && positions.length + pendingEntries.length === 0;
  elements["position-count"].textContent = positions.length;
  elements["pending-entry-count"].textContent = pendingEntries.length;
  document.getElementById("pending-entry-panel").hidden = pendingEntries.length === 0;
  elements["fill-count"].textContent = fills.length;
  elements["performance-count"].textContent = performance.length;
  elements["event-count"].textContent = events.length;
  renderRows(
    elements["position-rows"],
    positions,
    [
      (r) => ({ text: profileName(r.profile_id) }),
      token,
      (r) => ({ text: sol(r.cost_raw) }),
      (r) => ({ text: r.current_value_raw === null ? "Not valued" : sol(r.current_value_raw) }),
      (r) => ({
        text: r.unrealized_raw === null ? "Not valued" : signedSol(r.unrealized_raw),
        className: r.unrealized_raw === null ? "" : BigInt(r.unrealized_raw) >= 0n ? "positive" : "negative",
        title: `Raw token quantity ${r.amount_raw}`,
      }),
      (r) => ({ text: time(r.opened_at) }),
      (r) => ({
        text: r.profile_managed
          ? `${String(r.profile_id).replaceAll("_", " ")} manages exit`
          : r.close_pending
            ? "Close requested"
            : "Request full close",
        action: r.profile_managed ? undefined : "close-position",
        disabled: r.profile_managed || !mutationToken || r.close_pending,
        data: { mint: r.token_mint, amountRaw: r.amount_raw },
      }),
    ],
    "No positions are open. Automatic profiles will place the next eligible paper trade here.",
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
      (r) => ({ text: profileName(r.profile_id) }),
      (r) => ({ text: String(r.side).toUpperCase(), className: `side-${r.side}` }),
      token,
      (r) => ({
        text: sol(r.settlement_amount_raw),
        title: `${r.side === "buy" ? "Spent" : "Received"}; raw token quantity ${r.token_amount_raw}`,
      }),
      (r) => ({
        text: r.side === "sell" ? tradeReturn(r.completed_trade) : "—",
        className:
          r.side !== "sell" || !r.completed_trade
            ? ""
            : r.completed_trade.pnl >= 0n
              ? "positive"
              : "negative",
        title: r.side === "sell" ? "Percentage gain or loss against the position's purchase cost" : "Shown when this position is sold",
      }),
      (r) => ({ text: tradeReason(r.reason) }),
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
      (r) => ({
        text: r.return_percent,
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
  renderPerformanceInsights();
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
  performancePoints = points;
  renderChart(points);
  renderPerformanceInsights();
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
          ? "Paper-trading records changed. Controls reloaded."
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
  document.getElementById("alerts-panel").hidden = alerts.length === 0;
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
    "No unresolved processing alerts",
  );
}
async function refreshPipeline() {
  const response = await fetch("/api/paper/pipeline", { cache: "no-store" });
  if (!response.ok) throw new Error("market update status unavailable");
  const { pipeline } = await response.json();
  elements["pipeline-state"].textContent = pipeline.state;
  const summary = pipeline.lastResult?.summary;
  const acquisitionError = pipeline.lastError?.message;
  elements["pipeline-summary"].textContent = acquisitionError
    ? `Last market update failed: ${acquisitionError}. Retrying ${time(pipeline.nextRunAt)}.`
    : summary
      ? `Last cycle: ${summary.discovered} discovered · ${summary.candidatesEvaluated} evaluated · ${summary.riskEvaluated} risk decisions`
      : `Next market update ${time(pipeline.nextRunAt)}`;
  elements["pipeline-work"].replaceChildren();
  for (const item of pipeline.work) {
    const row = document.createElement("li"),
      label = document.createElement("span"),
      count = document.createElement("strong");
    const retry = item.retrying > 0 ? ` · ${item.retrying} retrying` : "";
    const screened = item.screenedOutLast24Hours > 0
      ? ` · ${item.screenedOutLast24Hours} screened out in 24h`
      : "";
    label.textContent = `${item.jobType.replaceAll("_", " ")} · ${item.state}${retry}${screened}`;
    if (item.lastError) {
      label.title = item.lastError;
      const reason = document.createElement("small");
      reason.className = "pipeline-error";
      reason.textContent = item.lastError;
      label.append(reason);
    }
    if (item.lastScreeningReason) {
      const reason = document.createElement("small");
      reason.className = "pipeline-error";
      reason.textContent = `Latest screening: ${item.lastScreeningReason}`;
      label.append(reason);
    }
    count.textContent = String(item.count);
    row.append(label, count);
    elements["pipeline-work"].append(row);
  }
  if (!pipeline.work.length) {
    const row = document.createElement("li");
    row.textContent = "No follow-up work is waiting";
    elements["pipeline-work"].append(row);
  }
}
async function refreshStrategyFunnel() {
  const response = await fetch("/api/paper/strategy-funnel", { cache: "no-store" });
  if (!response.ok) throw new Error("strategy funnel unavailable");
  const { rows } = await response.json();
  renderRows(
    elements["strategy-funnel-rows"],
    rows,
    [
      (row) => ({ text: profileName(row.profile_id) }),
      (row) => ({ text: Number(row.signals).toLocaleString() }),
      (row) => ({ text: Number(row.patterns).toLocaleString() }),
      (row) => ({ text: Number(row.market_confirmed).toLocaleString() }),
      (row) => ({ text: Number(row.qualified).toLocaleString() }),
      (row) => ({ text: Number(row.quote_failures).toLocaleString() }),
      (row) => ({ text: Number(row.buys).toLocaleString() }),
      (row) => ({ text: row.main_rejection || "No rejection recorded" }),
    ],
    "No strategies are currently active",
  );
}
function recordConnection(state, label) {
  connectionEvents.unshift({ state, label, at: new Date() });
  connectionEvents.splice(8);
  document.getElementById("connection-panel").hidden = state === "healthy";
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
    const [healthResponse, response] = await Promise.all([
      fetch("/api/health", { cache: "no-store" }),
      fetch("/api/paper/snapshot", { cache: "no-store" }),
    ]);
    const health = await healthResponse.json().catch(() => ({}));
    elements["database-health"].textContent = health.database === "ready" ? "Ready" : "Unavailable";
    elements["execution-mode"].textContent = health.mode === "paper" ? "Paper only" : "Unknown";
    if (!healthResponse.ok) throw new Error("health unavailable");
    if (!response.ok) throw new Error("snapshot unavailable");
    const { observedAt, performance } = await response.json();
    latestPerformance = performance;
    const equity = BigInt(performance.cashRaw) + BigInt(performance.openValueRaw);
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
      ? "App and trading records are healthy"
      : "A processing problem needs attention";
    elements["integrity-copy"].textContent = performance.healthy
      ? "The paper-trading records contain no unresolved processing errors."
      : `${performance.workerErrors} processing error${performance.workerErrors === 1 ? "" : "s"} require review.`;
    setStatus(
      performance.healthy ? "healthy" : "unhealthy",
      performance.healthy ? "Healthy" : "Attention required",
    );
    await refreshDetails();
    await refreshPerformance();
    await refreshAlerts();
    await refreshPipeline();
    await refreshStrategyFunnel().catch((error) => {
      console.error("Strategy funnel refresh failed", error);
      renderRows(elements["strategy-funnel-rows"], [], [], "Strategy activity is temporarily unavailable");
    });
    await refreshOperationalStatus();
    await refreshTradingProfiles().catch(() => undefined);
    recordConnection("healthy", "Snapshot received");
  } catch (error) {
    console.error("Dashboard refresh failed", error);
    elements["database-health"].textContent = "Unknown — dashboard disconnected";
    setStatus("error", "Snapshot unavailable");
    elements["integrity-title"].textContent = "Dashboard disconnected";
    elements["integrity-copy"].textContent =
      "The last saved values remain visible. Reconnecting automatically.";
    recordConnection("error", "Refresh failed");
  }
}
async function refreshOperationalStatus() {
  const response = await fetch("/api/operations/status", { cache: "no-store" });
  if (!response.ok) throw new Error("operational status unavailable");
  const { operations } = await response.json();
  elements["entry-lock-state"].textContent = operations.entryBlocked
    ? "ENTRIES BLOCKED"
    : "ENTRY OPEN";
  elements["entry-lock-state"].dataset.state = operations.entryBlocked ? "blocked" : "open";
  elements["entry-lock-reason"].textContent = operations.entryBlocked
    ? `${operations.entryBlockReason ?? "Operator stop active"}${operations.entryControlChangedBy ? ` · ${operations.entryControlChangedBy}` : ""}`
    : "Simulated entries may proceed automatically after every risk and evidence gate passes. No real transaction can be submitted in paper mode.";
  elements["approval-pending"].textContent = operations.approvals.pending;
  elements["approval-approved"].textContent = operations.approvals.approved;
  elements["approval-expiring"].textContent = operations.approvals.expiringSoon;
  elements["entry-queued"].textContent = operations.queuedEntries;
  elements["entry-submitted"].textContent = operations.submittedEntries;
  elements["reconciliation-backlog"].textContent = operations.reconciliationBacklog;
  elements["failed-work"].textContent = operations.failedWork;
  elements["telegram-state"].textContent = operations.telegramLastUpdateAt
    ? `Last command ${time(operations.telegramLastUpdateAt)}`
    : "No command recorded";
  const actions = [];
  if (operations.entryBlocked) actions.push("Review the stop reason before re-enabling entries.");
  if (operations.approvals.expiringSoon > 0)
    actions.push(`${operations.approvals.expiringSoon} approval request(s) need prompt review.`);
  if (operations.reconciliationBacklog > 0)
    actions.push(
      `${operations.reconciliationBacklog} submitted transaction(s) await independent reconciliation.`,
    );
  if (operations.failedWork > 0)
    actions.push(`${operations.failedWork} failed or retrying work item(s) require inspection.`);
  if (operations.telegramFailedUpdates > 0)
    actions.push(`${operations.telegramFailedUpdates} Telegram command(s) failed.`);
  elements["operator-action"].textContent = actions.length
    ? actions.join(" ")
    : "No immediate action is needed.";
  elements["operator-action"].dataset.state = actions.length ? "attention" : "clear";
  document.getElementById("operator-status").hidden = actions.length === 0;
  document.getElementById("activity-panel").hidden = true;
  document.getElementById("integrity-panel").hidden = true;
  if (operations.failedWork > 0) {
    elements["integrity-title"].textContent = "Trading workflow needs attention";
    elements["integrity-copy"].textContent =
      `${operations.failedWork} current work item${operations.failedWork === 1 ? " is" : "s are"} retrying or failed. Open Operations for the reported cause.`;
    setStatus("unhealthy", "Attention required");
  }
}
applyPreferences();
function updateNavigationState() {
  const target = location.hash || "#overview";
  const page =
    {
      "#overview": "overview",
      "#positions": "positions",
      "#performance": "performance",
      "#history": "history",
      "#watchlist": "watchlist",
      "#configurations": "configurations",
      "#benchmarks": "benchmarks",
      "#alerts": "operations",
      "#operator-status": "operations",
      "#allocation": "performance",
      "#events": "history",
    }[target] ?? "overview";
  document.body.dataset.page = page;
  document.querySelectorAll("main [data-dashboard-panel]").forEach((panel) => {
    if (!(panel instanceof HTMLElement)) return;
    const id = panel.dataset.dashboardPanel;
    panel.hidden = page === "overview" && Boolean(id && preferences.hiddenPanels.includes(id));
  });
  const pageCopy = {
    overview: ["Overview", "Portfolio state, operational attention and the next useful actions."],
    positions: ["Positions", "Review open holdings and cancellable paper entries."],
    performance: [
      "Performance",
      "Understand allocation, realised results and book-equity history.",
    ],
    history: ["History", "Inspect fills, realised outcomes and the evidence behind each decision."],
    watchlist: [
      "Watchlists",
      "Maintain tokens for observation without granting trading authority.",
    ],
    configurations: [
      "Trading profiles",
      "Run several paper strategies concurrently within one shared risk boundary.",
    ],
    benchmarks: [
      "Strategy benchmarks",
      "Compare TimSyS profiles with established, deterministic trading rules under the same conditions.",
    ],
    operations: ["Operations", "Check market connections, paper trading, data updates and alerts."],
  }[page];
  elements["page-title"].textContent = pageCopy[0];
  elements["page-description"].textContent = pageCopy[1];
  document.querySelectorAll("main [data-pages]").forEach((panel) => {
    panel.classList.toggle("page-hidden", !panel.dataset.pages.split(" ").includes(page));
  });
  document.querySelectorAll("#sidebar nav a").forEach((link) => {
    const linkPage = {
      "#overview": "overview",
      "#positions": "positions",
      "#performance": "performance",
      "#history": "history",
      "#watchlist": "watchlist",
      "#configurations": "configurations",
      "#benchmarks": "benchmarks",
      "#alerts": "operations",
    }[link.getAttribute("href")];
    if (linkPage === page) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  renderDetails();
  requestAnimationFrame(() =>
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" })),
  );
}
updateNavigationState();
window.addEventListener("hashchange", updateNavigationState);
void refreshWatchlists().catch(() =>
  setWatchlistMessage("Persistent watchlists unavailable.", "error"),
);
void refreshConfigurations().catch(() =>
  setConfigurationMessage("Trading configurations unavailable.", "error"),
);
void refreshTradingProfiles().catch(() =>
  setConfigurationMessage(
    "Trading profiles unavailable. Check that the latest database migration completed.",
    "error",
  ),
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
document.querySelectorAll("#sidebar nav a").forEach((link) =>
  link.addEventListener("click", (event) => {
    event.preventDefault();
    history.pushState(null, "", link.getAttribute("href"));
    updateNavigationState();
    closeMenu();
    window.scrollTo({ top: 0, behavior: preferences.motion === "reduced" ? "auto" : "smooth" });
    document.querySelector(".masthead")?.scrollTo({ top: 0 });
  }),
);
window.addEventListener("popstate", updateNavigationState);
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
elements["token-search"].addEventListener("input", () => {
  resetTablePages();
  renderDetails();
});
elements["side-filter"].addEventListener("change", () => {
  resetTablePages();
  renderDetails();
});
elements["clear-filters"].addEventListener("click", () => {
  elements["token-search"].value = "";
  elements["side-filter"].value = "all";
  resetTablePages();
  renderDetails();
});
elements["app-back"].addEventListener("click", () => {
  if (location.hash && location.hash !== "#overview") location.hash = "#overview";
  else if (history.length > 1) history.back();
});
elements["return-launcher"].addEventListener(
  "click",
  () => window.electronAPI?.returnToLauncher?.() ?? window.close(),
);
elements["action-dialog-form"].addEventListener("submit", (event) => {
  event.preventDefault();
  finishAction(
    elements["action-dialog-input-label"].hidden ? true : elements["action-dialog-input"].value,
  );
});
elements["action-dialog-cancel"].addEventListener("click", () => finishAction(null));
elements["action-dialog-close"].addEventListener("click", () => finishAction(null));
elements["action-dialog"].addEventListener("cancel", (event) => {
  event.preventDefault();
  finishAction(null);
});
elements["configuration-form"].addEventListener("input", () => {
  configurationDirty = true;
  if (!activeConfigurationId) {
    try {
      localStorage.setItem(configurationDraftKey, JSON.stringify(configurationValues()));
      setConfigurationMessage("Draft protected in this browser until it is created.");
    } catch {
      setConfigurationMessage("Draft protection is unavailable; keep this page open.", "error");
    }
  }
});
window.addEventListener("beforeunload", (event) => {
  if (!configurationDirty) return;
  event.preventDefault();
  event.returnValue = "";
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
  renderTradingProfiles();
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
elements["configuration-delete"].addEventListener("click", async () => {
  const selected = activeConfiguration();
  if (!selected) return;
  const confirmation = await requestAction({
    title: "Delete trading configuration?",
    message: `Type ${selected.name} to permanently delete this draft.`,
    label: "Configuration name",
    confirmLabel: "Delete permanently",
  });
  if (confirmation !== selected.name) return;
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
elements["watchlist-create"].addEventListener("click", async () => {
  const name = await requestAction({
    title: "Create watchlist",
    message: "Give the new watchlist a clear name.",
    label: "Watchlist name",
    confirmLabel: "Create",
  });
  if (name) void mutateWatchlist("/api/watchlists", "POST", { name });
});
elements["watchlist-rename"].addEventListener("click", async () => {
  const selected = activeWatchlist();
  if (!selected) return;
  const name = await requestAction({
    title: "Rename watchlist",
    message: "Choose a new watchlist name.",
    label: "Watchlist name",
    value: selected.name,
    confirmLabel: "Rename",
  });
  if (name)
    void mutateWatchlist(`/api/watchlists/${selected.id}`, "PATCH", {
      expectedVersion: selected.version,
      name,
    });
});
elements["watchlist-delete"].addEventListener("click", async () => {
  const selected = activeWatchlist();
  if (!selected) return;
  const confirmation = await requestAction({
    title: "Delete watchlist?",
    message: `Type ${selected.name} to permanently delete this watchlist.`,
    label: "Watchlist name",
    confirmLabel: "Delete permanently",
  });
  if (confirmation !== selected.name) return;
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
document.addEventListener("click", async (event) => {
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
    if (!signalId) return;
    const confirmation = await requestAction({
      title: "Cancel paper entry?",
      message: `Type ${signalId} to cancel this simulated entry.`,
      label: "Signal ID",
      confirmLabel: "Cancel entry",
    });
    if (confirmation !== signalId) return;
    void paperControlRequest(`/api/paper/orders/${signalId}/cancel`, {
      expectedVersion: version,
      confirmedSignalId: signalId,
    });
    return;
  }
  if (control?.dataset.paperAction === "close-position") {
    const mint = control.dataset.mint;
    const amountRaw = control.dataset.amountRaw;
    if (!mint || !amountRaw) return;
    const confirmation = await requestAction({
      title: "Request full paper close?",
      message: `Type ${mint} to request closure of this simulated position.`,
      label: "Token mint",
      confirmLabel: "Request close",
    });
    if (confirmation !== mint) return;
    void paperControlRequest(`/api/paper/positions/${mint}/close`, {
      confirmedMint: mint,
      expectedOpenAmountRaw: amountRaw,
    });
    return;
  }
  const target = event.target.closest("[data-token-mint]");
  if (target?.dataset.tokenMint) void openToken(target.dataset.tokenMint);
});
