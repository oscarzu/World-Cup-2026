// app.js — orchestration: load, render, tabs, theme, search/filter, live polling.

import { CONFIG } from "./config.js";
import { loadBase, applyLive } from "./api.js";
import { computeStandings } from "./standings.js";
import { computeScorers, goalStats } from "./scorers.js";
import { renderCharts, rethemeCharts } from "./charts.js";
import * as UI from "./render.js";

const $ = (s) => document.querySelector(s);
const state = { matches: [], source: "", online: true };

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
  UI.renderOverview(state.matches, stats, CONFIG.TOURNAMENT);
  UI.animateCounts($("#overview-stats"));
  UI.renderMatches(state.matches);
  UI.renderStandings(computeStandings(state.matches));
  UI.renderBracket(state.matches);
  UI.renderScorers(computeScorers(state.matches));
  UI.renderVenues();
  UI.renderStatsKpis(stats, state.matches);
  renderCharts(stats);

  // Live indicator + freshness.
  const liveCount = state.matches.filter((m) => m.status === "live").length;
  $("#live-indicator").hidden = liveCount === 0;
  $("#updated").textContent = "Act. " + new Date().toLocaleTimeString("es-MX",
    { hour: "2-digit", minute: "2-digit" });
  $("#data-source").textContent =
    `Fuente: ${state.source}${state.online ? "" : " (sin conexión)"} · ` +
    `${state.matches.filter((m) => m.score?.home != null).length} partidos con marcador.`;
}

// ---- live polling ----
async function poll() {
  const res = await applyLive(state.matches);
  if (res.applied > 0) renderAll();
}

// ---- boot ----
async function boot() {
  initTheme();
  initTabs();
  initMatchControls();

  try {
    const data = await loadBase();
    state.matches = data.matches;
    state.source = data.source;
    state.online = data.online;
    UI.fillMatchFilter(state.matches);
    renderAll();
  } catch (err) {
    console.error("No se pudieron cargar los datos:", err);
    $("#app").insertAdjacentHTML("afterbegin",
      `<p class="empty">No se pudieron cargar los datos de la Copa Mundial. Revisa tu conexión.</p>`);
    return;
  }

  // Best-effort live overlay now + on an interval.
  poll();
  setInterval(poll, CONFIG.POLL_INTERVAL);
}

// Chart.js loads with `defer`; wait for window load so it's defined.
window.addEventListener("load", boot);
