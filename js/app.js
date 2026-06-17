// app.js — orchestration: load, render, tabs, theme, search/filter, live polling.

import { CONFIG } from "./config.js";
import { loadBase, applyLive, loadTeamStats } from "./api.js";
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
  liveMatches: [], liveProvider: false,
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

// ---- tabs ----
function initTabs() {
  $("#tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t === btn));
    const id = btn.dataset.tab;
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("is-active", p.id === id));
    if (id === "stats" || id === "overview") renderCharts();
    if (id === "live") UI.renderSocial();
  });
}

// ---- matches filtering ----
function initMatchControls() {
  const apply = () => {
    const q = $("#match-search").value.trim().toLowerCase();
    const round = $("#match-filter").value;
    const filtered = state.matches.filter((m) =>
      (!round || m.round === round) &&
      (!q || m.home.name.toLowerCase().includes(q) || m.away.name.toLowerCase().includes(q)));
    UI.renderMatches(filtered);
  };
  $("#match-search").addEventListener("input", apply);
  $("#match-filter").addEventListener("change", apply);
}

// ---- rendering pass ----
function renderAll() {
  const stats = goalStats(state.matches);
  const facts = computeFacts(state.matches);
  UI.renderOverview(state.matches, stats, CONFIG.TOURNAMENT);
  UI.animateCounts($("#overview-stats"));
  UI.renderMatches(state.matches);
  UI.renderStandings(computeStandings(state.matches));
  UI.renderBracket(state.matches);
  UI.renderScorers(computeScorers(state.matches));
  const liveList = state.liveMatches.length ? state.liveMatches : state.matches;
  UI.renderLive(liveList, state.matches);
  UI.renderVenues();
  UI.renderStatsKpis(stats, state.matches);
  UI.renderAggregates(facts);
  UI.renderFacts(facts);
  UI.animateCounts($("#agg-grid"));
  const disc = computeDiscipline(state.teamStats);
  UI.renderDiscipline(disc);
  renderCharts(stats, facts, disc);

  // Live indicator + freshness.
  const liveCount = (state.liveMatches.length ? state.liveMatches : state.matches)
    .filter((m) => m.status === "live").length;
  $("#live-indicator").hidden = liveCount === 0;
  $("#updated").textContent = "Act. " + new Date().toLocaleTimeString("es-MX",
    { timeZone: CONFIG.TIMEZONE, hour: "2-digit", minute: "2-digit" }) + " " + CONFIG.TIMEZONE_LABEL;
  const provider = state.liveProvider ? "API-Football (en vivo)" : state.source;
  $("#data-source").textContent =
    `Fuente: ${provider}${state.online ? "" : " (sin conexión)"} · ` +
    `${state.matches.filter((m) => m.score?.home != null).length} partidos con marcador.`;
}

// ---- live polling ----
async function poll() {
  const res = await applyLive(state.matches);
  if (res.applied > 0) renderAll();
}

// Real-time layer via the API-Football proxy (only when configured).
async function refreshLive() {
  const [live, cards] = await Promise.allSettled([
    AF.fetchLiveMatches(), AF.fetchTopYellowCards(),
  ]);
  let changed = false;
  if (live.status === "fulfilled") { state.liveMatches = live.value; state.liveProvider = true; changed = true; }
  if (cards.status === "fulfilled" && cards.value.length) {
    state.teamStats = { ...state.teamStats, yellowCards: cards.value }; changed = true;
  }
  if (changed) renderAll();
}

// ---- boot ----
async function boot() {
  initTheme();
  initTabs();
  initMatchControls();

  try {
    const [data, teamStats] = await Promise.all([loadBase(), loadTeamStats()]);
    state.matches = data.matches;
    state.source = data.source;
    state.online = data.online;
    state.teamStats = teamStats;
    UI.fillMatchFilter(state.matches);
    renderAll();
  } catch (err) {
    console.error("No se pudieron cargar los datos:", err);
    $("#app").insertAdjacentHTML("afterbegin",
      `<p class="empty">No se pudieron cargar los datos de la Copa Mundial. Revisa tu conexión.</p>`);
    return;
  }

  // Real-time provider (API-Football via proxy) if configured; else the
  // best-effort community overlay. Both poll on an interval.
  if (AF.liveEnabled()) {
    refreshLive();
    setInterval(refreshLive, CONFIG.LIVE_POLL);
  } else {
    poll();
    setInterval(poll, CONFIG.POLL_INTERVAL);
  }
}

// Chart.js loads with `defer`; wait for window load so it's defined.
window.addEventListener("load", boot);
