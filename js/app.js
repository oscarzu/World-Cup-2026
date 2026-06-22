// app.js — orchestration: load, render, tabs, theme, search/filter, live polling.

import { CONFIG, teamES } from "./config.js";
import { getLang, setLang, applyStatic, t } from "./i18n.js";
import { loadBase, applyLive, loadTeamStats, loadEfficacyHistory, loadSocial } from "./api.js";
import { computeStandings } from "./standings.js";
import { computeScorers, goalStats } from "./scorers.js";
import { computeFacts } from "./facts.js";
import { computeDiscipline } from "./discipline.js";
import { renderCharts, rethemeCharts } from "./charts.js";
import * as AF from "./apifootball.js";
import * as UI from "./render.js";

const $ = (s) => document.querySelector(s);
const state = {
  matches: [], source: "", online: true,
  teamStats: { teams: {}, yellowCards: [] },
  liveMatches: [], liveProvider: false, liveUpdatedAt: null,
  effHistory: [], social: {},
};

// ---- theme ----
function initTheme() {
  const saved = localStorage.getItem("wc26:theme");
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  const theme = saved || (prefersLight ? "light" : "dark");
  document.documentElement.dataset.theme = theme;
  $(".theme-icon").textContent = theme === "dark" ? "🌙" : "☀️";

  $("#theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    $(".theme-icon").textContent = next === "dark" ? "🌙" : "☀️";
    localStorage.setItem("wc26:theme", next);
    rethemeCharts();
  });
}

// ---- tabs (ARIA tablist + keyboard) ----
function activateTab(btn) {
  if (!btn) return;
  document.querySelectorAll(".tab").forEach((tb) => {
    const on = tb === btn;
    tb.classList.toggle("is-active", on);
    tb.setAttribute("aria-selected", on ? "true" : "false");
  });
  const id = btn.dataset.tab;
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("is-active", p.id === id));
  // Keep the active tab visible in the horizontally-scrolling bar (mobile).
  btn.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  if (id === "stats" || id === "overview") renderCharts();
  if (id === "live") { UI.renderSocial(); UI.renderSocialArchive(state.matches, state.social); }
}

function initTabs() {
  const tabs = [...document.querySelectorAll(".tab")];
  $("#tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (btn) activateTab(btn);
  });
  // Arrow-key navigation per the WAI-ARIA tabs pattern.
  $("#tabs").addEventListener("keydown", (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    let n = null;
    if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = tabs.length - 1;
    if (n == null) return;
    e.preventDefault();
    tabs[n].focus();
    activateTab(tabs[n]);
  });
}

// ---- chart drill-down: tap a bar → a detail modal built from state ----
function initDrill() {
  window.addEventListener("wc:drill", (e) => {
    const { chart, key } = e.detail || {};
    if (chart === "chart-groups") return drillGroup(key);
    return drillTeam(chart, key); // teams / fouls / efficacy charts key on team name
  });
}
function matchesForTeam(name) {
  return state.matches.filter((m) =>
    (m.home.name === name || m.away.name === name) && m.score?.home != null)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}
function drillGroup(group) {
  const rows = computeStandings(state.matches).get(group) || [];
  const en = getLang() === "en";
  UI.openModal({
    title: `${t("drill.group")} ${group.replace("Group ", "")}`,
    subtitle: en ? "Current standings" : "Clasificación actual",
    rows: rows.map((r) => [UI.teamLabel(r.name), `${r.Pts} ${en ? "pts" : "pts"} · ${r.GF}-${r.GA}`]),
  });
}
function drillTeam(chart, name) {
  const ms = matchesForTeam(name);
  const disc = state._lastDisc || {};
  const rows = [];
  const find = (arr) => (arr || []).find((x) => x.name === name);
  const goalsFor = ms.reduce((s, m) => s + (m.home.name === name ? m.score.home : m.score.away), 0);
  rows.push([t("drill.matches"), String(ms.length)]);
  rows.push([t("drill.goalsFor"), String(goalsFor)]);
  const ef = find(disc.efficacy);
  if (ef) { rows.push([t("drill.shotsOn"), String(ef.shots)]); rows.push([t("drill.conv"), `${Math.round(ef.pct)}%`]); }
  const fr = find(disc.foulsRanking);
  if (fr) rows.push([t("drill.foulsPm"), fr.perMatch.toFixed(1)]);
  UI.openModal({ title: UI.teamLabel(name), flagTeam: name, rows, matches: ms });
}

// ---- matches filtering ----
// Accent-insensitive so "México"/"Mexico" both match; searches BOTH the raw
// data name (e.g. "Germany") and the translated label shown on screen
// (e.g. "Alemania") so the visible name always works.
const fold = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function initMatchControls() {
  const apply = () => {
    const raw = $("#match-search").value.trim();
    const q = fold(raw);
    const round = $("#match-filter").value;
    const filtered = state.matches.filter((m) => {
      if (round && m.round !== round) return false;
      if (!q) return true;
      return [m.home.name, m.away.name, UI.teamLabel(m.home.name), UI.teamLabel(m.away.name)]
        .some((n) => fold(n).includes(q));
    });
    UI.renderMatches(filtered);
    UI.renderMatchStatus({ count: filtered.length, query: raw, round });
  };
  $("#match-search").addEventListener("input", apply);
  $("#match-filter").addEventListener("change", apply);
  // Delegated clear action from the status row.
  $("#match-status").addEventListener("click", (e) => {
    if (!e.target.closest("[data-clear]")) return;
    $("#match-search").value = "";
    $("#match-filter").value = "";
    apply();
  });
}

// ---- rendering pass ----
function renderAll() {
  const stats = goalStats(state.matches);
  const facts = computeFacts(state.matches);
  UI.renderOverview(state.matches, stats, CONFIG.TOURNAMENT);
  UI.renderHeroLead(stats);
  UI.animateCounts($("#overview-stats"));
  UI.renderMatches(state.matches);
  const standings = computeStandings(state.matches);
  UI.renderStandings(standings);
  UI.renderBracket(state.matches, standings);
  UI.renderScorers(computeScorers(state.matches));
  const liveList = state.liveMatches.length ? state.liveMatches : state.matches;
  UI.renderLive(liveList, state.matches);
  UI.renderVenues();
  UI.renderStatsKpis(stats, state.matches);
  UI.renderAggregates(facts);
  UI.renderAddedTime(facts);
  UI.renderFacts(facts);
  UI.animateCounts($("#agg-grid"));

  // Matches played per team (for fouls-per-match), keyed like discipline expects.
  const matchesByTeam = {};
  for (const m of state.matches) {
    if (!(m.score && m.score.home != null)) continue;
    for (const nm of [m.home.name, m.away.name]) {
      const k = teamES(nm); matchesByTeam[k] = (matchesByTeam[k] || 0) + 1;
    }
  }
  const disc = computeDiscipline(state.teamStats, matchesByTeam);
  state._lastDisc = disc; // for chart drill-downs
  UI.renderDiscipline(disc);
  UI.renderInsightStrip(stats, facts, disc);
  renderCharts(stats, facts, disc, state.effHistory);
  UI.renderSocialArchive(state.matches, state.social);

  // Live indicator + freshness.
  const en = getLang() === "en";
  const liveCount = (state.liveMatches.length ? state.liveMatches : state.matches)
    .filter((m) => m.status === "live").length;
  // Colour the "Live" tab only while a match is actually live, and surface the
  // count in the label (not colour-only — accessible signal).
  const liveTab = document.querySelector('.tab[data-tab="live"]');
  if (liveTab) {
    liveTab.classList.toggle("has-live", liveCount > 0);
    const label = liveTab.querySelector(".tab-label");
    if (label) label.textContent = liveCount > 0 ? `${t("tab.live")} · ${liveCount}` : t("tab.live");
    liveTab.setAttribute("aria-label", liveCount > 0 ? `${t("tab.live")} (${liveCount})` : t("tab.live"));
  }
  const time = new Date().toLocaleTimeString(en ? "en-US" : "es-MX",
    { timeZone: CONFIG.TIMEZONE, hour: "2-digit", minute: "2-digit" });
  $("#updated").textContent = `${en ? "Upd." : "Act."} ${time} ${CONFIG.TIMEZONE_LABEL}`;
  const provider = state.liveProvider ? (en ? "ESPN (live)" : "ESPN (en vivo)") : state.source;
  const withScore = state.matches.filter((m) => m.score?.home != null).length;
  $("#data-source").textContent = en
    ? `Source: ${provider}${state.online ? "" : " (offline)"} · ${withScore} matches with a result.`
    : `Fuente: ${provider}${state.online ? "" : " (sin conexión)"} · ${withScore} partidos con marcador.`;
}

// ---- live polling ----
async function poll() {
  const res = await applyLive(state.matches);
  if (res.applied > 0) renderAll();
}

// Real-time layer via the API-Football proxy (only when configured).
function liveStatusArgs() {
  const hasLive = state.liveMatches.some((m) => m.status === "live");
  const intervalMin = Math.round((hasLive ? CONFIG.LIVE_POLL : CONFIG.LIVE_POLL_IDLE) / 60000);
  return { provider: state.liveProvider, updatedAt: state.liveUpdatedAt, intervalMin };
}

async function refreshLive() {
  try {
    const snap = await AF.fetchSnapshot();
    state.liveMatches = snap.live;
    state.liveProvider = true;
    state.liveUpdatedAt = snap.updatedAt || Date.now(); // server time → same for everyone
    if (snap.yellowCards.length) {
      state.teamStats = { ...state.teamStats, yellowCards: snap.yellowCards };
    }
    // Our own accumulated team dataset (fouls/shots/goals) overrides curated when present.
    try {
      const teams = await AF.fetchLiveTeamStats();
      if (teams && Object.keys(teams).length) {
        state.teamStats = { ...state.teamStats, teams };
      }
    } catch (_) { /* keep curated teams */ }
    renderAll();
  } catch (_) {
    /* proxy unreachable / no data → keep curated, do not flip provider */
  }
  UI.renderLiveStatus(liveStatusArgs());
}

// Adaptive, visibility-aware loop: poll every 5 min while a match is live,
// back off to 15 min otherwise, and never poll while the tab is hidden.
let liveTimer = null;
async function liveTick() {
  if (document.visibilityState === "visible") {
    try { await refreshLive(); } catch (_) { /* keep curated */ }
  }
  const hasLive = state.liveMatches.some((m) => m.status === "live");
  clearTimeout(liveTimer);
  liveTimer = setTimeout(liveTick, hasLive ? CONFIG.LIVE_POLL : CONFIG.LIVE_POLL_IDLE);
}

function startLiveLoop() {
  liveTick();
  // Refresh immediately when the user returns to the tab if data is stale.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const stale = !state.liveUpdatedAt || (Date.now() - state.liveUpdatedAt) > CONFIG.LIVE_POLL;
    if (stale) refreshLive();
  });
  // Tick the "Actualizado hace…" label without hitting the API.
  setInterval(() => UI.renderLiveStatus(liveStatusArgs()), 30 * 1000);
}

// ---- language (ES/EN) ----
function initLang() {
  const buttons = document.querySelectorAll("#lang-toggle button");
  const paint = () => buttons.forEach((b) => b.classList.toggle("is-active", b.dataset.lang === getLang()));
  document.documentElement.lang = getLang();
  applyStatic();
  paint();
  buttons.forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.lang === getLang()) return;
    setLang(b.dataset.lang);
    document.documentElement.lang = getLang();
    applyStatic();
    paint();
    UI.fillMatchFilter(state.matches); // re-label round options in the new language
    renderAll();
    UI.renderLiveStatus(liveStatusArgs());
  }));
}

// ---- boot ----
// Start the live layer exactly once (survives a retry after a failed load).
let liveStarted = false;
function startLiveOnce() {
  if (liveStarted) return;
  liveStarted = true;
  // Real-time provider (ESPN via proxy) if configured; else the best-effort
  // community overlay. Both poll on an interval.
  if (AF.liveEnabled()) {
    UI.renderLiveStatus(liveStatusArgs()); // show legend immediately
    startLiveLoop();
  } else {
    poll();
    setInterval(poll, CONFIG.POLL_INTERVAL);
  }
}

// The data-loading pass — re-runnable from the error state's Retry button.
async function loadData() {
  UI.showLoading();
  try {
    const [data, teamStats, effHistory, social] = await Promise.all([
      loadBase(), loadTeamStats(), loadEfficacyHistory(), loadSocial(),
    ]);
    state.matches = data.matches;
    state.source = data.source;
    state.online = data.online;
    state.teamStats = teamStats;
    state.effHistory = effHistory;
    state.social = social;
    UI.fillMatchFilter(state.matches);
    renderAll();
    UI.clearLoading();
    if (!state.online) UI.showOfflineBanner(); // fell back to bundled snapshot
    startLiveOnce();
  } catch (err) {
    console.error("No se pudieron cargar los datos:", err);
    UI.showFatalError(loadData); // blocking state with a working Retry
  }
}

async function boot() {
  initTheme();
  initLang();
  initTabs();
  initMatchControls();
  initDrill();
  await loadData();
}

// Chart.js loads with `defer`; wait for window load so it's defined.
window.addEventListener("load", boot);
