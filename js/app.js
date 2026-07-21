// app.js — orchestration: load, render, tabs, theme, search/filter, live polling.

import { CONFIG, teamES } from "./config.js";
import { getLang, setLang, applyStatic, t } from "./i18n.js";
import { loadBase, applyLive, loadTeamStats, loadEfficacyHistory, loadSocial } from "./api.js";
import { computeStandings } from "./standings.js";
import { resolveKnockouts, rankThirds } from "./qualification.js";
import { computeScorers, goalStats, goalsByScorer } from "./scorers.js";
import { computeFacts, shootoutStats } from "./facts.js";
import { computeDiscipline } from "./discipline.js";
import { renderCharts, rethemeCharts, drawGoalsByMatchday } from "./charts.js";
import { buildKnockoutICS, downloadICS } from "./calendar.js";
import { buildModel, upcomingPredictions, backtest } from "./predictions.js";
import * as AF from "./apifootball.js";
import * as UI from "./render.js";

const $ = (s) => document.querySelector(s);

// Centre a chip/tab inside its own horizontal scroller WITHOUT moving the page
// vertically (scrollIntoView would yank the whole page — caused a scroll loop
// in the Stats sub-nav while scrolling down).
function centerInScroller(el) {
  const sc = el && el.parentElement;
  if (!sc || sc.scrollWidth <= sc.clientWidth) return; // nothing to scroll
  const left = el.offsetLeft - (sc.clientWidth - el.offsetWidth) / 2;
  sc.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
}
const state = {
  matches: [], source: "", online: true,
  teamStats: { teams: {}, yellowCards: [] },
  liveMatches: [], liveProvider: false, liveUpdatedAt: null,
  effHistory: [], social: {},
};

// ---- theme ----
const THEME_BG = { dark: "#050507", light: "#eef0f4" };
function paintTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $(".theme-icon").textContent = theme === "dark" ? "🌙" : "☀️";
  // Keep the browser UI colour (status bar / address bar) in sync (WIG).
  document.getElementById("meta-theme")?.setAttribute("content", THEME_BG[theme]);
}
function initTheme() {
  const saved = localStorage.getItem("wc26:theme");
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  paintTheme(saved || (prefersLight ? "light" : "dark"));

  $("#theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    paintTheme(next);
    localStorage.setItem("wc26:theme", next);
    rethemeCharts();
  });
}

// ---- tabs (ARIA tablist + keyboard + URL hash) ----
function activateTab(btn, { updateHash = true } = {}) {
  if (!btn) return;
  document.querySelectorAll(".tab").forEach((tb) => {
    const on = tb === btn;
    tb.classList.toggle("is-active", on);
    tb.setAttribute("aria-selected", on ? "true" : "false");
  });
  const id = btn.dataset.tab;
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("is-active", p.id === id));
  // Keep the active tab visible in the horizontally-scrolling bar (mobile)
  // without scrolling the page vertically.
  centerInScroller(btn);
  // Reflect state in the URL so tabs are deep-linkable / shareable (WIG).
  if (updateHash && location.hash.slice(1) !== id) history.replaceState(null, "", `#${id}`);
  if (id === "stats" || id === "overview") renderCharts();
  if (id === "matches") setTimeout(() => UI.scrollMatchesToToday(), 60); // jump to today's fixtures
}

function initTabs() {
  const tabs = [...document.querySelectorAll(".tab")];
  $("#tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (btn) activateTab(btn);
  });
  // Open the tab referenced by the URL hash (deep link) + respond to back/forward.
  const fromHash = () => {
    const id = location.hash.slice(1);
    const btn = id && document.querySelector(`.tab[data-tab="${id}"]`);
    if (btn) activateTab(btn, { updateHash: false });
  };
  fromHash();
  window.addEventListener("hashchange", fromHash);
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
function dispatchDrill(chart, key) {
  if (chart === "chart-groups") return drillGroup(key);
  if (chart === "chart-moments") return drillFact(key); // category → which games
  if (chart === "chart-overview") return drillPhase(key); // phase → zoom into detail
  return drillTeam(chart, key); // teams / fouls / efficacy / red charts key on team name
}

// Goals-by-phase drill-down: the group bar zooms into goals per matchday; a
// knockout-round bar lists that round's matches.
function drillPhase(key) {
  if (key === "group") {
    const md = (state._stats && state._stats.byMatchday) || [];
    UI.openInfoModal({
      title: `${t("ov.goalsByMd")} · ${t("ph.group")}`,
      html: `<p class="modal-sub">${t("drill.mdSub")}</p><div class="chart-box modal-chart"><canvas id="md-zoom"></canvas></div>`,
    });
    // Wait for the canvas to be in the DOM, then draw the zoomed chart.
    requestAnimationFrame(() => drawGoalsByMatchday("md-zoom", md));
    return;
  }
  // Knockout round → the matches played in that round.
  const ms = state.matches
    .filter((m) => m.round === key && m.score?.home != null)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  UI.openModal({ title: UI.roundLabel(key), matches: ms });
}

// Match list behind a derived stat (comebacks, shootouts, biggest, …).
const FACT_LABEL = {
  comebacks: "f.comebacks", shootouts: "f.shootouts", blowouts: "f.blowouts",
  zeroZero: "f.zerozero", cleansheets: "f.cleansheets", pengoals: "f.pengoals",
  hattricks: "f.hattricks", highest: "f.highest", biggest: "f.biggest",
  fastest: "f.fastest", latest: "f.latest", topattack: "f.topattack",
};
function factMatches(key) {
  const f = state._facts || {}, L = f.lists || {};
  switch (key) {
    case "comebacks": return L.comebacks || [];
    case "shootouts": return L.shootouts || [];
    case "blowouts": return L.blowouts || [];
    case "zeroZero": return L.zeroZero || [];
    case "cleansheets": return L.cleanSheets || [];
    case "pengoals": return L.penaltyGoals || [];
    case "hattricks": return (f.hatTricks || []).map((h) => h.m);
    case "highest": return f.highest ? [f.highest.m] : [];
    case "biggest": return f.biggest ? [f.biggest.m] : [];
    case "fastest": return f.fastest ? [f.fastest.m] : [];
    case "latest": return f.latest ? [f.latest.m] : [];
    case "topattack": return f.topTeams && f.topTeams[0] ? matchesForTeam(f.topTeams[0].name) : [];
    default: return [];
  }
}
function drillFact(key) {
  const f = state._facts || {};
  const title = t(FACT_LABEL[key] || key);
  const matches = factMatches(key);
  // Hat-tricks: list the players too.
  let rows = key === "hattricks"
    ? (f.hatTricks || []).map((h) => [h.name, `${h.n} ${t("u.goals")}`])
    : [];
  // Earliest/latest goal: surface the exact minute + scorer, not just the score.
  if ((key === "fastest" || key === "latest") && f[key]) {
    const g = f[key];
    rows = [
      [t("drill.minute"), `${g.min}'`],
      [t("drill.scorer"), g.name || "—"],
    ];
  }
  UI.openModal({ title, rows, matches });
}
function initDrill() {
  window.addEventListener("wc:drill", (e) => {
    const { chart, key } = e.detail || {};
    dispatchDrill(chart, key);
  });
  document.addEventListener("click", (e) => {
    // "See detail" disclosure on charts (keyboard/SR path).
    const toggle = e.target.closest(".drill-btn");
    if (toggle) {
      const list = toggle.parentNode.querySelector(".drill-list");
      const show = list.hidden;
      list.hidden = !show;
      toggle.setAttribute("aria-expanded", String(show));
      return;
    }
    const item = e.target.closest(".drill-item");
    if (item) { dispatchDrill(item.dataset.chart, item.dataset.key); return; }
    // Clickable fact cards → which matches/teams.
    const card = e.target.closest(".fact[data-fact]");
    if (card) { drillFact(card.dataset.fact); return; }
    // Scorer rows → which teams they scored against.
    const sc = e.target.closest(".scorer[data-scorer-name]");
    if (sc) { drillScorer(sc.dataset.scorerName, sc.dataset.scorerCountry); return; }
    // "See all" → jump to the Matches tab.
    const goto = e.target.closest("[data-goto]");
    if (goto) { const tab = document.querySelector(`.tab[data-tab="${goto.dataset.goto}"]`); if (tab) activateTab(tab); return; }
    // VAR aggregate cards → the incidents behind the number.
    const varCard = e.target.closest(".stat.agg[data-var]");
    if (varCard) { drillVar(varCard.dataset.var); return; }
    // Any match with a result → full detail (score breakdown, goals, forecast).
    const mEl = e.target.closest("[data-match-id]");
    if (mEl) openMatchDetail(mEl.dataset.matchId);
  });
  // Keyboard activation (Enter/Space) for fact + VAR + scorer cards.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const fc = e.target.closest && e.target.closest(".fact[data-fact]");
    if (fc) { e.preventDefault(); drillFact(fc.dataset.fact); return; }
    const sc = e.target.closest && e.target.closest(".scorer[data-scorer-name]");
    if (sc) { e.preventDefault(); drillScorer(sc.dataset.scorerName, sc.dataset.scorerCountry); return; }
    const vc = e.target.closest && e.target.closest(".stat.agg[data-var]");
    if (vc) { e.preventDefault(); drillVar(vc.dataset.var); return; }
    const mEl = e.target.closest && e.target.closest("[data-match-id]");
    if (mEl) { e.preventDefault(); openMatchDetail(mEl.dataset.matchId); }
  });
}

// Full detail for one match: score breakdown, goals and the model's forecast.
function openMatchDetail(id) {
  const matches = state.matchesResolved || state.matches;
  const m = matches.find((x) => x.id === id);
  if (!m) return;
  const sample = (state._bt && state._bt.samples || []).find((s) => s.match?.id === id);
  const en = getLang() === "en";
  UI.openInfoModal({
    title: `${UI.teamLabel(m.home.name)} ${en ? "vs" : "vs"} ${UI.teamLabel(m.away.name)}`,
    html: UI.matchDetailHTML(m, sample),
  });
}

// A scorer's goal log: every goal, against whom, minute and penalty flag.
function drillScorer(name, country) {
  const log = (state._goalsByScorer && state._goalsByScorer.get(`${name}__${country}`)) || [];
  const en = getLang() === "en";
  const html = log.length
    ? `<div class="goal-log">${log.map((g, i) => `
        <div class="gl-row">
          <span class="gl-n">${i + 1}</span>
          ${UI.flagImg(g.opponent)}
          <span class="gl-vs">${en ? "vs" : "vs"} <b>${esc(UI.teamLabel(g.opponent))}</b></span>
          <span class="gl-min">${g.minute != null ? g.minute + "'" : ""}${g.penalty ? ` <small>(${en ? "pen" : "pen"})</small>` : ""}</span>
        </div>`).join("")}</div>`
    : `<p class="empty">${t("drill.noData")}</p>`;
  UI.openInfoModal({
    title: `${name} · ${UI.teamLabel(country)}`,
    html: `<p class="modal-sub">${log.length} ${log.length === 1 ? t("u.goal") : t("u.goals")} · ${t("drill.scorerSub")}</p>${html}`,
  });
}
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function drillVar(kind) {
  const inc = (CONFIG.TOURNAMENT.varIncidents || {})[kind] || [];
  const title = t(kind === "restored" ? "a.restored" : "a.disallowed");
  const rows = inc.map((x) =>
    `<div class="var-row"><div class="var-top"><b>${x.match}</b><span class="var-min">${x.min}'</span></div>
       <div class="var-reason">🎯 ${x.team} · ${x.reason}</div></div>`).join("");
  UI.openInfoModal({
    title,
    html: `<p class="modal-sub">${t("a.varNote")}</p><div class="var-list">${rows || `<p class="empty">${t("drill.noData")}</p>`}</div>`,
  });
}
function matchesForTeam(name) {
  return state.matches.filter((m) =>
    (m.home.name === name || m.away.name === name) && m.score?.home != null)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}
function drillGroup(group) {
  const rows = computeStandings(state.matches).get(group) || [];
  // Which teams advanced as best thirds (for a definitive ✓/✗ per row).
  const qThirds = new Set(rankThirds(computeStandings(state.matches))
    .filter((tr) => tr.qualified).map((tr) => tr.name));
  const totalGoals = rows.reduce((s, r) => s + (r.GF || 0), 0);
  const advanced = (r, i) => i < 2 || (i === 2 && qThirds.has(r.name));
  // Each row explains the numbers and states the outcome with certainty.
  const statRows = rows.map((r, i) => [
    `${i + 1}. ${UI.teamLabel(r.name)} ${advanced(r, i) ? "✅" : "❌"}`,
    `${r.Pts} ${t("drill.pts")} · ${r.GF}-${r.GA} ${t("drill.gfga")}`,
  ]);
  UI.openModal({
    title: `${t("drill.group")} ${group.replace("Group ", "")}`,
    subtitle: `${t("drill.groupGoals")}: ${totalGoals} · ${t("drill.groupLegend")}`,
    rows: statRows,
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
const DIACRITICS = /\p{Diacritic}/gu; // hoisted out of the hot filter (js-hoist-regexp)
const fold = (s) => String(s || "").normalize("NFD").replace(DIACRITICS, "").toLowerCase();

function initMatchControls() {
  const apply = () => {
    const raw = $("#match-search").value.trim();
    const q = fold(raw);
    const round = $("#match-filter").value;
    const filtered = (state.matchesResolved || state.matches).filter((m) => {
      if (round && m.round !== round) return false;
      if (!q) return true;
      return [m.home.name, m.away.name, UI.teamLabel(m.home.name), UI.teamLabel(m.away.name)]
        .some((n) => fold(n).includes(q));
    });
    UI.renderMatches(filtered, { grouped: !raw && !round }); // grouped when unfiltered
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

// ---- scorers search ----
function applyScorerFilter() {
  const input = $("#scorer-search");
  const q = fold(input ? input.value.trim() : "");
  const list = state._scorers || [];
  if (!q) { UI.renderScorers(list); return; }
  const out = list.filter((s) =>
    fold(s.name).includes(q) || fold(s.country).includes(q) || fold(UI.teamLabel(s.country)).includes(q));
  UI.renderScorers(out, { filtered: true });
}
function initScorerControls() {
  $("#scorer-search")?.addEventListener("input", applyScorerFilter);
}

// ---- stats sub-nav scroll-spy ----
// Tracks every visible section and highlights the topmost one (deterministic,
// no flicker), and keeps the active chip centred in its own scroller.
function initSubnav() {
  const nav = $("#stats-subnav");
  if (!nav || !("IntersectionObserver" in window)) return;
  const links = [...nav.querySelectorAll("a")];
  const ids = links.map((a) => a.getAttribute("href").slice(1));
  const byId = new Map(links.map((a, i) => [ids[i], a]));
  const visible = new Set();
  let current = null;
  const setCurrent = (id) => {
    if (id === current) return;
    current = id;
    const link = byId.get(id);
    links.forEach((a) => {
      const on = a === link;
      a.classList.toggle("is-current", on);
      if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
    // NOTE: deliberately do NOT scroll here — the scroll-spy only highlights.
    // Moving the chip during scroll was pulling the whole page back up.
  };
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) { if (en.isIntersecting) visible.add(en.target.id); else visible.delete(en.target.id); }
    const first = ids.find((id) => visible.has(id)); // topmost in document order
    if (first) setCurrent(first);
  }, { rootMargin: "-130px 0px -55% 0px", threshold: 0 });
  for (const id of ids) { const sec = document.getElementById(id); if (sec) io.observe(sec); }
}

// ---- matches hub: schedule ↔ bracket sub-views (one consolidated tab) ----
function initMatchViews() {
  const seg = document.getElementById("match-views");
  if (!seg) return;
  const views = { list: $("#view-list"), bracket: $("#view-bracket") };
  seg.addEventListener("click", (e) => {
    const btn = e.target.closest(".subview-btn");
    if (!btn) return;
    const v = btn.dataset.view;
    seg.querySelectorAll(".subview-btn").forEach((b) => {
      const on = b === btn;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    for (const k in views) if (views[k]) views[k].hidden = k !== v;
    if (v === "list") setTimeout(() => UI.scrollMatchesToToday(), 60);
  });
}

// Subscribe modal — copy URL + platform links. More reliable than navigating to
// a webcal:// URL (which errors in browsers without a handler).
function openSubscribeModal() {
  const base = (CONFIG.LIVE_PROXY_URL || "").trim();
  if (!base) return;
  // ?lang follows the selected tab so the feed comes in the right language.
  const httpsUrl = base.replace(/\/+$/, "") + "/calendar.ics?lang=" + getLang();
  const webcal = httpsUrl.replace(/^https?:/, "webcal:");
  const gcal = "https://calendar.google.com/calendar/r?cid=" + encodeURIComponent(webcal);
  UI.openInfoModal({
    title: t("cal.subTitle"),
    html: `<p class="modal-sub">${t("cal.subBody")}</p>
      <input class="cal-url" type="text" readonly value="${httpsUrl}" onclick="this.select()" />
      <div class="cal-links">
        <button type="button" id="cal-copy" class="btn-cal">${t("cal.copy")}</button>
        <a class="btn-cal" href="${gcal}" target="_blank" rel="noopener">${t("cal.gcal")}</a>
        <a class="btn-cal" href="${webcal}">${t("cal.apple")}</a>
      </div>`,
  });
  document.getElementById("cal-copy")?.addEventListener("click", async (e) => {
    try { await navigator.clipboard.writeText(httpsUrl); e.target.textContent = t("cal.copied"); } catch (_) {}
  });
}

// ---- add knockout fixtures to calendar ----
function initCalendar() {
  // Download a static .ics (snapshot of today's projected teams), localized to
  // the current UI language and enriched with flags, venue and broadcasters.
  $("#add-calendar")?.addEventListener("click", () => {
    const matches = state.matchesResolved || state.matches;
    const ics = buildKnockoutICS(matches, computeStandings(state.matches), getLang());
    downloadICS(ics);
  });
  // Subscribe buttons live in both the Matches/bracket view AND the home page.
  // A "subscribe (auto-updates)" calendar makes no sense once the tournament is
  // over, so hide them in archive mode; the static .ics download stays as a keepsake.
  const base = (CONFIG.LIVE_PROXY_URL || "").trim();
  const subBtns = document.querySelectorAll("#sub-calendar, #sub-calendar-home");
  subBtns.forEach((b) => {
    if (CONFIG.ARCHIVED || !base) { b.hidden = true; return; }
    b.addEventListener("click", openSubscribeModal);
  });
}

// Keep --topbar-h in sync with the sticky topbar's real height, so sub-stickies
// (e.g. the Matches view switcher) can sit exactly below it on any viewport.
function initStickyOffset() {
  const bar = document.querySelector(".topbar");
  if (!bar) return;
  const set = () => document.documentElement.style.setProperty("--topbar-h", `${bar.offsetHeight}px`);
  set();
  if ("ResizeObserver" in window) new ResizeObserver(set).observe(bar);
  window.addEventListener("resize", set, { passive: true });
}

// ---- back-to-top (long Stats page) ----
function initBackToTop() {
  const btn = document.createElement("button");
  btn.className = "to-top";
  btn.type = "button";
  btn.setAttribute("aria-label", t("a11y.top"));
  btn.innerHTML = "↑";
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  document.body.appendChild(btn);
  const onScroll = () => btn.classList.toggle("show", window.scrollY > 600);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

// ---- rendering pass ----
function renderAll() {
  const stats = goalStats(state.matches);
  state._stats = stats; // for the goals-by-phase → matchday drill-down
  const facts = computeFacts(state.matches);
  // Prefer REAL added (stoppage) time measured by the Worker from ESPN's own
  // match clock over the bundled estimate. Only override when the Worker
  // actually captured measurable minutes; otherwise keep the labelled estimate.
  const realAT = state.teamStats?.addedTime;
  if (realAT && realAT.avgPerMatch != null && realAT.matches > 0) facts.addedTime = realAT;
  state._facts = facts; // for clickable fact-card drill-downs
  const standings = computeStandings(state.matches);
  // Resolve knockout placeholder codes (1A, 3A/B/C/D/F, …) into real teams from
  // the final standings — openfootball lags filling these once groups finish.
  const resolved = resolveKnockouts(state.matches, standings);
  state.matchesResolved = resolved;
  UI.renderOverview(resolved, stats, CONFIG.TOURNAMENT);
  UI.renderHeroNext(resolved);
  UI.renderChampion(resolved, facts);
  UI.renderHeroLead(stats);
  UI.animateCounts($("#overview-stats"));
  UI.renderMatches(resolved, { grouped: true });
  UI.renderStandings(standings);
  UI.renderBracket(state.matches, standings);
  UI.renderQualification(standings);
  const model = buildModel(resolved);
  const bt = backtest(resolved);
  state._bt = bt; // for the per-match detail modal (forecast storytelling)
  UI.renderPredictions(upcomingPredictions(resolved, model, 16), bt);
  UI.renderPredReport(bt); // predicted vs actual on played matches
  // Rank is assigned on the full FIFA-ordered table so it's preserved when the
  // list is filtered by search.
  state._scorers = computeScorers(state.matches).map((s, i) => ({ ...s, rank: i + 1 }));
  state._goalsByScorer = goalsByScorer(state.matches); // per-player goal log (drill-down)
  UI.renderScorersPodium(state._scorers);
  applyScorerFilter();
  const liveList = state.liveMatches.length ? state.liveMatches : state.matches;
  UI.renderHomeLive(liveList);
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
  UI.renderGoalkeeping(disc);
  UI.renderShootouts(shootoutStats(resolved));
  UI.renderInsightStrip(stats, facts, disc);
  // Efficacy history: never show a phase that hasn't actually been played. Group
  // matchday entries always pass (the group stage is complete); a knockout-phase
  // entry only shows once every match in that round has a result.
  const KO_PHASES = ["Round of 32", "Round of 16", "Quarter-final", "Semi-final", "Match for third place", "Final"];
  const phaseComplete = (round) => {
    const ms = state.matches.filter((m) => m.round === round);
    return ms.length > 0 && ms.every((m) => m.score && m.score.home != null);
  };
  const completed = new Set(KO_PHASES.filter(phaseComplete));
  const effHist = (state.effHistory || []).filter((h) => h.matchday != null || h.phase === "group" || completed.has(h.phase));
  renderCharts(stats, facts, disc, effHist);

  // Freshness label.
  const en = getLang() === "en";
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
  // Tournament concluded: the data is frozen, so we start no live layer and make
  // no polling requests at all.
  if (CONFIG.ARCHIVED) return;
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

// Privacy-friendly visit metrics (Cloudflare Web Analytics) — only when a token
// is configured; no cookies, no PII. Stats appear in the Cloudflare dashboard.
function initAnalytics() {
  const token = (CONFIG.CF_ANALYTICS_TOKEN || "").trim();
  if (!token) return;
  const s = document.createElement("script");
  s.defer = true;
  s.src = "https://static.cloudflareinsights.com/beacon.min.js";
  s.setAttribute("data-cf-beacon", JSON.stringify({ token }));
  document.body.appendChild(s);
}

async function boot() {
  initTheme();
  initLang();
  initTabs();
  initMatchControls();
  initMatchViews();
  initScorerControls();
  initSubnav();
  initStickyOffset();
  initBackToTop();
  initCalendar();
  initDrill();
  initAnalytics();
  setInterval(() => UI.tickHeroCountdown(), 1000); // hero countdown
  await loadData();
}

// Chart.js loads with `defer`; wait for window load so it's defined.
window.addEventListener("load", boot);
