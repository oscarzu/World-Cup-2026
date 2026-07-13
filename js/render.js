// render.js — pure DOM rendering helpers. No data fetching here.

import { VENUES, CONFIG } from "./config.js";
import { flagUrl, kickoffLabel, kickoffDateTime, kickoffDate } from "./api.js";
import { t, tName, getLang } from "./i18n.js";
import { qualification, teamTop2Status } from "./qualification.js";

const $ = (sel, root = document) => root.querySelector(sel);
const tn = tName; // selección name in the active language (EN = original)
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Integer with thousands separators (e.g. 2914 -> "2,914"). Non-numerics pass through.
export const fmtInt = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString("en-US") : String(n ?? "—");
};

// ---- app-level states: loading / fatal error / offline -------------------

// Skeleton placeholders while the first data load is in flight.
export function showLoading() {
  const app = document.getElementById("app");
  if (app) app.setAttribute("aria-busy", "true");
  const os = document.getElementById("overview-stats");
  if (os) os.innerHTML = Array.from({ length: 6 }, () => `<div class="skeleton sk-stat"></div>`).join("");
  const ol = document.getElementById("overview-live");
  if (ol) ol.innerHTML = Array.from({ length: 3 }, () => `<div class="skeleton sk-row"></div>`).join("");
}

export function clearLoading() {
  document.getElementById("app")?.setAttribute("aria-busy", "false");
}

// Full-screen blocking error with a working Retry button.
export function showFatalError(onRetry) {
  hideFatalError();
  document.getElementById("app")?.setAttribute("aria-busy", "false");
  const el = document.createElement("div");
  el.id = "fatal-overlay";
  el.className = "fatal-overlay";
  el.setAttribute("role", "alert");
  el.innerHTML = `
    <div class="fatal-card">
      <div class="fatal-ic" aria-hidden="true">📡</div>
      <h2>${esc(t("err.title"))}</h2>
      <p>${esc(t("err.body"))}</p>
      <button type="button" id="retry-btn" class="btn-primary">${esc(t("err.retry"))}</button>
    </div>`;
  document.body.appendChild(el);
  el.querySelector("#retry-btn").addEventListener("click", () => {
    hideFatalError();
    onRetry?.();
  });
}

export function hideFatalError() {
  document.getElementById("fatal-overlay")?.remove();
}

// Dismissible banner shown when we fall back to the bundled snapshot.
export function showOfflineBanner() {
  if (document.getElementById("net-banner")) return;
  const b = document.createElement("div");
  b.id = "net-banner";
  b.className = "net-banner";
  b.setAttribute("role", "status");
  b.innerHTML = `<span>📦 ${esc(t("offline.msg"))}</span>
    <button type="button" class="net-x" aria-label="${esc(t("offline.close"))}">✕</button>`;
  document.body.insertBefore(b, document.body.firstChild);
  b.querySelector(".net-x").addEventListener("click", () => b.remove());
}

// Wikimedia Commons hi-res image via the stable Special:FilePath redirect.
const venuePhoto = (file) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1600`;

export function flagImg(team, cls = "flag", { eager = false } = {}) {
  const url = flagUrl(team);
  // width/height give an intrinsic ratio (prevents layout shift); CSS sets the
  // actual rendered size. onerror hides a flag that fails to load (no broken
  // icon); referrerpolicy keeps flagcdn happy. `eager` is used where lazy is
  // unreliable (the bracket lives in a hidden, horizontally-scrolling tab).
  const loading = eager ? "eager" : "lazy";
  return url
    ? `<img class="${cls}" src="${url}" alt="" width="28" height="19" loading="${loading}" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'" />`
    : `<span class="${cls}" aria-hidden="true"></span>`;
}

const STATUS = {
  live: { cls: "live", key: "badge.live" },
  finished: { cls: "ft", key: "badge.ft" },
  scheduled: { cls: "up", key: "badge.up" },
};

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString(getLang() === "en" ? "en-US" : "es-MX",
    { weekday: "short", day: "numeric", month: "short" });
}

// Hoisted regexes (reused across loops — js-hoist-regexp).
const RE_MATCHDAY = /Matchday (\d+)/;
const RE_POS = /^([12])([A-L])$/;
const RE_THIRD = /^3/;
const RE_WINNER = /^W(\d+)$/;
const RE_CODE = /^([12][A-L]|3[A-L/]+|W\d+)$/;

// Translate a round/stage name to the active language.
const KO_KEY = {
  "Round of 32": "br.r32", "Round of 16": "br.r16", "Quarter-final": "br.qf",
  "Semi-final": "br.sf", "Final": "br.final", "Match for third place": "br.third",
};
export function roundLabel(round) {
  const md = RE_MATCHDAY.exec(round || "");
  if (md) return `${t("br.matchday")} ${md[1]}`;
  return KO_KEY[round] ? t(KO_KEY[round]) : (round || "");
}

// Chronological comparison by date then kickoff time.
const byKickoff = (a, b) => {
  if (a.date !== b.date) return (a.date || "").localeCompare(b.date || "");
  const ta = kickoffDate(a)?.getTime() ?? Infinity;
  const tb = kickoffDate(b)?.getTime() ?? Infinity;
  return ta - tb;
};

// Knockout winner: goals decide it; if level after extra time, the penalty
// shootout does. Returns "home" | "away" | null.
export function koWinnerSide(m) {
  const hs = m.score?.home, as = m.score?.away;
  if (hs == null || as == null) return null;
  if (hs > as) return "home";
  if (as > hs) return "away";
  const ph = m.score?.penHome, pa = m.score?.penAway;
  if (ph == null || pa == null) return null;
  return ph > pa ? "home" : pa > ph ? "away" : null;
}
export function koWinnerName(m) {
  const side = koWinnerSide(m);
  return side === "home" ? m.home?.name : side === "away" ? m.away?.name : null;
}

// ---- match card ----
export function matchCard(m, { showGoals = true } = {}) {
  const st = STATUS[m.status] || STATUS.scheduled;
  const hasScore = m.score && m.score.home != null;
  const center = hasScore
    ? `<div class="score">${m.score.home} – ${m.score.away}</div>`
    : `<div class="meta">${esc(kickoffLabel(m) || t("tbd"))}</div>`;
  const pen = m.score?.penHome != null
    ? `<div class="meta">${t("br.pens")} ${m.score.penHome}–${m.score.penAway}</div>`
    : (m.score?.etHome != null ? `<div class="meta">${t("br.aet")}</div>` : "");

  let goals = "";
  if (showGoals && m.goals?.length) {
    const h = m.goals.filter((g) => g.team === "home")
      .map((g) => `${esc(g.name)} ${g.minute}'${g.penalty ? " (p)" : ""}`).join(", ");
    const a = m.goals.filter((g) => g.team === "away")
      .map((g) => `${esc(g.name)} ${g.minute}'${g.penalty ? " (p)" : ""}`).join(", ");
    goals = `<div class="goal-line">⚽ ${h || "—"} &nbsp;·&nbsp; ${a || "—"}</div>`;
  }

  const venue = m.ground ? `<div class="match-venue">📍 ${esc(venueFifa(m.ground))}</div>` : "";
  // Always show the exact date (+ kickoff time) so grouped/ranged lists are legible.
  const when = m.date ? (kickoffDateTime(m) || fmtDate(m.date)) : "";
  const dateLine = when ? `<div class="match-when">🗓️ ${esc(when)}</div>` : "";
  return `
  <div class="match ${m.status === "live" ? "is-live" : ""}">
    ${dateLine}
    <div class="side home">${flagImg(m.home.name)}<span class="nm">${esc(tn(m.home.name))}</span></div>
    <div class="center">
      <span class="badge ${st.cls}">${t(st.key)}</span>
      ${center}${pen}
    </div>
    <div class="side away">${flagImg(m.away.name)}<span class="nm">${esc(tn(m.away.name))}</span></div>
    ${goals}${venue}
  </div>`;
}

// ---- overview ----
export function renderOverview(matches, stats, tournament) {
  $("#hero-dates").textContent =
    `11 jun – 19 jul 2026 · ${tournament.hosts.join(" · ")}`;

  const kpis = [
    [t("kpi.teams"), tournament.teams],
    [t("kpi.groups"), tournament.groups],
    [t("kpi.matches"), tournament.matches],
    [t("kpi.venues"), tournament.stadiums],
    [t("kpi.goals"), stats.goals],
    [t("kpi.gpm"), stats.avg ? stats.avg.toFixed(2) : "0.00"],
  ];
  $("#overview-stats").innerHTML = kpis.map(([l, n]) =>
    `<div class="stat"><div class="num" data-count="${n}">${fmtInt(n)}</div><div class="label">${l}</div></div>`
  ).join("");

  // Live now + the next kickoffs, ordered chronologically and dated.
  const live = matches.filter((m) => m.status === "live");
  const upcoming = matches.filter((m) => m.status === "scheduled")
    .sort((a, b) => (kickoffDate(a)?.getTime() ?? Infinity) - (kickoffDate(b)?.getTime() ?? Infinity))
    .slice(0, 6 - live.length);
  const seeMore = `<button type="button" class="see-more" data-goto="matches">${t("ov.seeAll")} →</button>`;
  $("#overview-live").innerHTML = (live.length || upcoming.length)
    ? [...live.map((m) => matchCard(m, { showGoals: false })), ...upcoming.map(upcomingCard)].join("") + seeMore
    : `<p class="empty">${t("empty.noUpcoming")}</p>` + seeMore;
}

// ---- matches tab ----
// grouped (default): collapsible sections per round, each a multi-column grid
// that uses the desktop width and keeps the long list compact. flat: a simple
// dated list (used for filtered/search results).
export function renderMatches(matches, { grouped = false } = {}) {
  const wrap = $("#match-list");
  if (!wrap) return;
  if (!matches.length) { wrap.innerHTML = `<p class="empty">${t("empty.noResults")}</p>`; return; }
  const ordered = [...matches].sort(byKickoff);

  if (!grouped) {
    let html = "", lastDay = "";
    for (const m of ordered) {
      if (m.date !== lastDay) { html += `<div class="day-sep" data-date="${esc(m.date)}">${fmtDate(m.date)} — ${esc(roundLabel(m.round))}</div>`; lastDay = m.date; }
      html += matchCard(m);
    }
    wrap.innerHTML = html;
    return;
  }

  // Group by round, preserving chronological order.
  const groups = [];
  const idx = new Map();
  for (const m of ordered) {
    if (!idx.has(m.round)) { idx.set(m.round, groups.length); groups.push({ round: m.round, items: [] }); }
    groups[idx.get(m.round)].items.push(m);
  }
  const today = new Date().toISOString().slice(0, 10);
  let openIdx = groups.findIndex((g) => g.items.some((m) => (m.date || "") >= today));
  if (openIdx < 0) openIdx = groups.length - 1;

  wrap.innerHTML = groups.map((g, i) => {
    const dates = g.items.map((m) => m.date).filter(Boolean).sort();
    const range = dates.length
      ? (dates[0] === dates[dates.length - 1] ? fmtDate(dates[0]) : `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`)
      : "";
    return `<details class="md-group" data-date="${esc(dates[0] || "")}"${i === openIdx ? " open" : ""}>
      <summary><span class="mg-title">${esc(roundLabel(g.round))}</span><span class="mg-meta">${g.items.length} ${t("u.matches")}${range ? ` · ${range}` : ""}</span></summary>
      <div class="match-grid">${g.items.map((m) => matchCard(m)).join("")}</div>
    </details>`;
  }).join("");
}

// Position the matches list at today's date (or the next upcoming day).
export function scrollMatchesToToday() {
  const wrap = $("#match-list");
  if (!wrap) return;
  const today = new Date().toISOString().slice(0, 10);
  const open = wrap.querySelector(".md-group[open]");
  const seps = [...wrap.querySelectorAll(".day-sep")];
  const target = open || seps.find((s) => (s.dataset.date || "") >= today) || seps[seps.length - 1];
  target?.scrollIntoView({ block: "start", behavior: "smooth" });
}

// Team name in the active language (used by the search to match what's shown).
export const teamLabel = (name) => tName(name);

// Result count + active-filter feedback under the matches toolbar.
export function renderMatchStatus({ count, query, round }) {
  const el = $("#match-status");
  if (!el) return;
  const active = query || round;
  if (!active) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  const noun = count === 1 ? t("search.one") : t("search.many");
  const lead = count === 0 && query
    ? `${t("search.none")} “${esc(query)}”`
    : `${fmtInt(count)} ${noun}`;
  el.innerHTML = `<span>${lead}</span>
    <button type="button" class="status-clear" data-clear>${esc(t("search.clear"))} ✕</button>`;
}

const KO_ORDER = ["Round of 32", "Round of 16", "Quarter-final", "Semi-final", "Match for third place", "Final"];
export function fillMatchFilter(matches) {
  const sel = $("#match-filter");
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => {
    const ma = RE_MATCHDAY.exec(a), mb = RE_MATCHDAY.exec(b);
    if (ma && mb) return Number(ma[1]) - Number(mb[1]); // matchdays in numeric order
    if (ma) return -1; if (mb) return 1;                // group stage before knockouts
    return KO_ORDER.indexOf(a) - KO_ORDER.indexOf(b);   // knockouts in bracket order
  });
  sel.innerHTML = `<option value="">${t("matches.allRounds")}</option>` +
    rounds.map((r) => `<option value="${esc(r)}">${esc(roundLabel(r))}</option>`).join("");
}

// ---- standings ----
export function renderStandings(groupsMap) {
  const grid = $("#groups-grid");
  if (!groupsMap.size) { grid.innerHTML = `<p class="empty">${t("empty.noPlayed")}</p>`; return; }
  grid.innerHTML = [...groupsMap.entries()].map(([g, rows]) => `
    <div class="group-card">
      <h3>${esc(g)}</h3>
      <table class="standings">
        <thead><tr><th class="team" style="text-align:left">${t("st.team")}</th>
          <th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th></tr></thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr class="${i < 2 ? "qual" : ""}">
              <td class="team">${flagImg(r.name)}<span>${esc(tn(r.name))}</span></td>
              <td>${r.P}</td><td>${r.W}</td><td>${r.D}</td><td>${r.L}</td>
              <td>${r.GF}</td><td>${r.GA}</td><td>${r.GD > 0 ? "+" : ""}${r.GD}</td>
              <td class="pts">${r.Pts}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`).join("");
}

// ---- match predictions (Poisson + Elo prior) ----
export function renderPredictions(ups, bt) {
  const wrap = $("#predictions");
  if (!wrap) return;
  const pct = (x) => Math.round(x * 100);
  const CF = { low: "pred.cf.low", lowmod: "pred.cf.lowmod", mod: "pred.cf.mod", modhigh: "pred.cf.modhigh" };

  const conf = bt ? `
    <div class="pred-conf">
      <div class="pc-head">${t("pred.confTitle")}: <b class="pc-level cf-${bt.confidence}">${t(CF[bt.confidence] || "pred.cf.low")}</b></div>
      <div class="pc-stats">
        <div><span class="pc-k">${t("pred.acc")}</span><span class="pc-v">${pct(bt.accuracy)}%</span></div>
        <div><span class="pc-k">${t("pred.rps")}</span><span class="pc-v">${bt.rps} <small>(${t("pred.vs")} ${bt.baselineRps})</small></span></div>
        <div><span class="pc-k">${t("pred.tested")}</span><span class="pc-v">${bt.n}</span></div>
      </div>
    </div>` : "";

  if (!ups || !ups.length) {
    wrap.innerHTML = conf + `<p class="empty">${t("pred.none")}</p><p class="pred-note">${t("pred.note")}</p>`;
    return;
  }
  const bars = (p) => p.knockout && p.advance
    ? `<div class="pred-bar" role="img" aria-label="${pct(p.advance.home)}% vs ${pct(p.advance.away)}%">
         <span class="pb home" style="width:${pct(p.advance.home)}%"></span>
         <span class="pb away" style="width:${pct(p.advance.away)}%"></span>
       </div>
       <div class="pred-legend">
         <span><b>${pct(p.advance.home)}%</b> ${t("pred.advance")}</span>
         <span class="pred-pen" title="${t("pred.penNote")}">🥅 ${pct(p.penaltyProb)}% ${t("pred.pens")}</span>
         <span><b>${pct(p.advance.away)}%</b> ${t("pred.advance")}</span>
       </div>`
    : `<div class="pred-bar" role="img" aria-label="${pct(p.probs.home)}% ${esc(tn(p.home))}, ${pct(p.probs.draw)}% ${t("pred.draw")}, ${pct(p.probs.away)}% ${esc(tn(p.away))}">
         <span class="pb home" style="width:${pct(p.probs.home)}%"></span>
         <span class="pb draw" style="width:${pct(p.probs.draw)}%"></span>
         <span class="pb away" style="width:${pct(p.probs.away)}%"></span>
       </div>
       <div class="pred-legend">
         <span><b>${pct(p.probs.home)}%</b> ${esc(tn(p.home))}</span>
         <span><b>${pct(p.probs.draw)}%</b> ${t("pred.draw")}</span>
         <span><b>${pct(p.probs.away)}%</b> ${esc(tn(p.away))}</span>
       </div>`;
  const cards = ups.map(({ match: m, prediction: p }) => `
    <div class="pred-card">
      <div class="pred-when">${esc(kickoffDateTime(m) || fmtDate(m.date))}${p.knockout ? ` · <span class="pred-ko">${t("pred.ko")}</span>` : ""}</div>
      <div class="pred-teams">
        <span class="pt">${flagImg(m.home.name)}<span class="ptn">${esc(tn(m.home.name))}</span></span>
        <span class="pred-score" title="${t("pred.xg")}: ${p.expHome} – ${p.expAway}">${p.scoreline}</span>
        <span class="pt right"><span class="ptn">${esc(tn(m.away.name))}</span>${flagImg(m.away.name)}</span>
      </div>
      ${bars(p)}
    </div>`).join("");
  wrap.innerHTML = conf + `<div class="pred-grid">${cards}</div><p class="pred-note">${t("pred.note")}</p>`;
}

// ---- model report card: predicted vs actual on already-played matches ----
export function renderPredReport(bt) {
  const wrap = $("#pred-report");
  if (!wrap) return;
  const samples = (bt && bt.samples) || [];
  if (!samples.length) { wrap.innerHTML = `<p class="empty">${t("pred.repNone")}</p>`; return; }
  const pct = (x) => Math.round(x * 100);
  // Most recent first; show a manageable window.
  const recent = samples.slice(-12).reverse();
  const outName = (m, who) => who === "draw" ? t("pred.draw") : tn(who === "home" ? m.home.name : m.away.name);
  const summary = `
    <div class="pr-summary">
      <div><span class="pr-k">${t("pred.repAcc")}</span><span class="pr-v">${pct(bt.accuracy)}%</span><small>${samples.filter((s) => s.correct).length}/${samples.length}</small></div>
      <div><span class="pr-k">${t("pred.repExact")}</span><span class="pr-v">${pct(bt.exactScore)}%</span><small>${samples.filter((s) => s.exact).length}/${samples.length}</small></div>
    </div>`;
  const rows = recent.map((s) => {
    const m = s.match;
    return `<div class="pr-card ${s.correct ? "hit" : "miss"}">
      <div class="pr-match">
        <span class="pr-t">${flagImg(m.home.name)}<span class="pr-tn">${esc(tn(m.home.name))}</span></span>
        <span class="pr-sc">${esc(s.actScore)}</span>
        <span class="pr-t right"><span class="pr-tn">${esc(tn(m.away.name))}</span>${flagImg(m.away.name)}</span>
      </div>
      <div class="pr-lines">
        <span class="pr-line"><b>${t("pred.repPick")}:</b> ${esc(outName(m, s.predOutcome))} <small>(${esc(s.predScore)})</small></span>
        <span class="pr-verdict ${s.correct ? "ok" : "no"}">${s.correct ? "✓ " + t("pred.repHit") : "✗ " + t("pred.repMiss")}</span>
      </div>
    </div>`;
  }).join("");
  wrap.innerHTML = summary + `<div class="pr-grid">${rows}</div><p class="pred-note">${t("pred.repNote")}</p>`;
}

// ---- road to the Round of 32: qualified teams + best thirds + what-if ----
export function renderQualification(standings) {
  const wrap = $("#qualification");
  if (!wrap) return;
  if (!standings || !standings.size) { wrap.innerHTML = ""; return; }
  const q = qualification(standings);

  // Team cell: flag + translated name + ✓ (confirmed) / proy (projected).
  const cell = (row, done) => row
    ? `<span class="q-team">${flagImg(row.name)}<span class="q-tn">${esc(tn(row.name))}</span>${done ? `<span class="q-ok">✓</span>` : `<span class="q-pp">${t("br.proj")}</span>`}</span>`
    : "—";
  // Qualified table: one row per group (winner + runner-up).
  const qualTable = `
    <table class="q-table">
      <thead><tr><th>${t("drill.group")}</th><th>${t("q.firsts")}</th><th>${t("q.seconds")}</th></tr></thead>
      <tbody>${q.winners.map((w, i) => `
        <tr><td class="q-g">${esc(w.group)}</td><td>${cell(w.row, w.done)}</td><td>${cell(q.runners[i].row, q.runners[i].done)}</td></tr>`).join("")}
      </tbody>
    </table>`;
  // Best-thirds table with the cut line after the 8th.
  const thirdsTable = `
    <table class="q-table q-thirds-t">
      <thead><tr><th>#</th><th>${t("st.team")}</th><th>${t("drill.group")}</th><th>PJ</th><th>Pts</th><th>DG</th><th>${t("q.thStatus")}</th></tr></thead>
      <tbody>${q.thirds.map((tr) => `
        <tr class="${tr.qualified ? "q-in" : "q-out"}${tr.rank === 8 ? " q-cutrow" : ""}">
          <td class="q-rk">${tr.rank}</td>
          <td><span class="q-team">${flagImg(tr.name)}<span class="q-tn">${esc(tn(tr.name))}</span></span></td>
          <td>${esc(tr.group)}</td><td>${tr.P}</td><td>${tr.Pts}</td><td>${tr.GD > 0 ? "+" : ""}${tr.GD}</td>
          <td><span class="q-st ${tr.qualified ? "good" : "bad"}">${tr.qualified ? t("q.thIn") : t("q.thOut")}</span></td>
        </tr>`).join("")}
      </tbody>
    </table>`;

  // Definitive advancement: 1st & 2nd advance; a 3rd advances only if it ranks
  // among the best 8 thirds; everyone else is eliminated.
  const qualThirds = new Set((q.thirds || []).filter((tr) => tr.qualified).map((tr) => tr.name));
  const advStatus = (rows, i) => {
    if (i < 2) return { key: "q.advTop", cls: "good" };
    if (i === 2) return qualThirds.has(rows[i].name)
      ? { key: "q.advThird", cls: "good" }
      : { key: "q.elim", cls: "bad" };
    return { key: "q.elim", cls: "bad" };
  };
  const whatif = q.groups.map(([g, rows]) => `
    <div class="q-wgroup">
      <h5>${esc(g)}</h5>
      ${rows.map((r, i) => {
        const { key, cls } = advStatus(rows, i);
        return `<div class="q-wrow ${cls}"><span class="q-wpos">${i + 1}</span>${flagImg(r.name)}<span class="q-wnm">${esc(tn(r.name))}</span><span class="q-wpts">${r.Pts}</span><span class="q-wtag">${t(key)}</span></div>`;
      }).join("")}
    </div>`).join("");

  wrap.innerHTML = `
    <p class="q-explain" data-i18n-html="q.explain">${t("q.explain")}</p>
    <div class="q-sub-head">${t("q.qualifiedTitle")}</div>
    <div class="q-scroll">${qualTable}</div>
    <div class="q-sub-head">${t("q.thirdsTitle")} <span class="q-cut">${t("q.cut")}</span></div>
    <div class="q-scroll">${thirdsTable}</div>
    <details class="q-whatif">
      <summary>${t("q.whatifTitle")}</summary>
      <div class="q-wgrid">${whatif}</div>
    </details>
    <p class="q-note">${q.allDone ? t("q.noteDone") : t("q.noteProj")}</p>`;
}

// ---- bracket (Apple-Sports-style, live-projected) ----
// Knockout fixtures store position codes ("1A" = winner Group A, "2B" =
// runner-up Group B, "3A/B/C/D/F" = best third among those groups, "W73" =
// winner of match 73). We resolve them against today's standings/results so
// the bracket shows "how it stands today".
const groupDone = (rows) => rows && rows.length >= 4 && rows.every((r) => r.P >= 3);

function rankedThirds(standings) {
  const thirds = [];
  for (const [g, rows] of standings) {
    if (rows[2]) thirds.push({ group: g.replace("Group ", ""), ...rows[2] });
  }
  thirds.sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || a.name.localeCompare(b.name));
  return thirds;
}

// Resolve one slot code → { name, flagTeam, proj, label }.
function resolveSlot(code, ctx) {
  const { standings, thirds, usedThirds, winners } = ctx;
  let m = RE_POS.exec(code);
  if (m) {
    const rows = standings.get("Group " + m[2]);
    const r = rows && rows[Number(m[1]) - 1];
    if (r && r.P > 0) return { name: tn(r.name), flagTeam: r.name, proj: !groupDone(rows) };
    return { name: `${t(m[1] === "1" ? "br.pos1" : "br.pos2")} ${m[2]}`, placeholder: true };
  }
  if (RE_THIRD.test(code)) {
    const groups = code.slice(1).split("/");
    for (const tr of thirds) {
      if (groups.includes(tr.group) && !usedThirds.has(tr.name) && tr.P > 0) {
        usedThirds.add(tr.name);
        return { name: tn(tr.name), flagTeam: tr.name, proj: true };
      }
    }
    return { name: `${t("br.best3")} ${groups.join("/")}`, placeholder: true };
  }
  m = RE_WINNER.exec(code);
  if (m) {
    const w = winners[m[1]];
    if (w) return { name: tn(w), flagTeam: w, proj: true };
    return { name: `${t("br.winner")} #${m[1]}`, placeholder: true };
  }
  // The slot is already a real team (the base data fills teams in as the bracket
  // is drawn): show it translated + with its flag, as a confirmed qualifier.
  if (flagUrl(code)) return { name: tn(code), flagTeam: code };
  return { name: code, placeholder: true };
}

export function renderBracket(matches, standings = new Map()) {
  const wrap = $("#bracket-wrap");
  if (!wrap) return;

  // Map finished knockout matches → winner (real team), so later rounds resolve.
  // A level score after extra time is decided by the penalty shootout.
  const isCode = (s) => RE_CODE.test(s || "");
  const winners = {};
  for (const m of matches) {
    const hs = m.score?.home, as = m.score?.away;
    if (hs == null || as == null || m.num == null) continue;
    const w = koWinnerName(m);
    if (w && !isCode(w)) winners[m.num] = w;
  }
  const ctx = { standings, thirds: rankedThirds(standings), usedThirds: new Set(), winners };

  // Pre-resolve every knockout slot in match-number order so the greedy
  // best-third assignment is deterministic.
  const ko = matches.filter((m) => m.stage === "knockout");
  const byNum = new Map(matches.filter((m) => m.num != null).map((m) => [m.num, m]));
  const slot = new Map();
  for (const m of [...ko].sort((a, b) => (a.num ?? 0) - (b.num ?? 0))) {
    slot.set(m.id, { home: resolveSlot(m.home.name, ctx), away: resolveSlot(m.away.name, ctx) });
  }

  // Build the two bracket halves by following the W## links down from the final.
  const childNums = (m) => [m.home.name, m.away.name]
    .map((c) => { const w = /^W(\d+)$/.exec(c || ""); return w ? Number(w[1]) : null; })
    .filter((x) => x != null);
  const final = matches.find((m) => m.round === "Final");
  const third = matches.find((m) => m.round === "Match for third place");
  const collect = (rootNum) => {
    const out = { "Round of 32": [], "Round of 16": [], "Quarter-final": [], "Semi-final": [] };
    const stack = [rootNum];
    while (stack.length) {
      const m = byNum.get(stack.pop());
      if (!m) continue;
      if (out[m.round]) out[m.round].push(m);
      for (const c of childNums(m)) stack.push(c);
    }
    for (const k in out) out[k].sort((a, b) => a.num - b.num);
    return out;
  };
  const [lRoot, rRoot] = final ? childNums(final) : [];
  const left = collect(lRoot), right = collect(rRoot);

  const slotInner = (s) => {
    const flag = s.flagTeam ? flagImg(s.flagTeam, "flag", { eager: true }) : `<span class="flag" aria-hidden="true"></span>`;
    const tag = s.proj ? `<span class="bk-proj" title="${esc(t("br.projFull"))}">${t("br.proj")}</span>` : "";
    return `${flag}<span class="nm">${esc(s.name)}</span>${tag}`;
  };
  // Compact tie card. Round comes from the column header, so the card stays
  // small (2 rows + score) and short → the boxes line up cleanly under each
  // phase like a real bracket. Venue/time live in the title (and show on mobile).
  const card = (m, big = false) => {
    if (!m) return "";
    const s = slot.get(m.id) || { home: resolveSlot(m.home.name, ctx), away: resolveSlot(m.away.name, ctx) };
    const hs = m.score?.home, as = m.score?.away, played = hs != null;
    const sc = (v) => (played ? `<span class="bk-sc">${v}</span>` : "");
    // Winner may be decided in extra time or on penalties (level score).
    const win = played ? koWinnerSide(m) : null;
    const hasPen = m.score?.penHome != null && m.score?.penAway != null;
    const etPlayed = m.score?.etHome != null;
    const note = hasPen ? `${t("br.pens")} ${m.score.penHome}–${m.score.penAway}`
      : etPlayed ? t("br.aet") : "";
    const penLine = note ? `<div class="bk-pen">${note}</div>` : "";
    const v = VENUES[m.ground];
    const where = v ? v.city : (m.ground || "");
    const when = played ? "" : (kickoffDate(m) ? kickoffDateTime(m) : fmtDate(m.date));
    const meta = `${where}${when ? ` · ${when}` : ""}`;
    const no = m.num != null ? `<span class="bkm-no" aria-hidden="true">#${m.num}</span>` : "";
    const title = `${m.num != null ? `#${m.num} · ` : ""}${meta}`;
    // Show both teams; fade the one that was eliminated so the advancing path
    // reads like a route through the bracket (a "maze" of survivors).
    const hCls = win === "home" ? "win" : win === "away" ? "lost" : "";
    const aCls = win === "away" ? "win" : win === "home" ? "lost" : "";
    return `<div class="bkm${big ? " big" : ""}" title="${esc(title)}">
      ${no}
      <div class="bkm-r ${hCls} ${s.home.placeholder ? "tbd" : ""}">${slotInner(s.home)}${sc(hs)}</div>
      <div class="bkm-r ${aCls} ${s.away.placeholder ? "tbd" : ""}">${slotInner(s.away)}${sc(as)}</div>
      ${penLine}
      ${meta ? `<div class="bkm-v">📍 ${esc(meta)}</div>` : ""}
    </div>`;
  };
  const colHtml = (label, list) =>
    `<div class="bk-col"><div class="bk-cl">${esc(label)}</div><div class="bk-matches">${list.map((m) => card(m)).join("")}</div></div>`;

  const L = (r) => left[r] || [], R = (r) => right[r] || [];
  wrap.innerHTML = `
    <div class="bracket-tree">
      <div class="bk-half left">
        ${colHtml(t("br.r32"), L("Round of 32"))}
        ${colHtml(t("br.r16"), L("Round of 16"))}
        ${colHtml(t("br.qf"), L("Quarter-final"))}
        ${colHtml(t("br.sf"), L("Semi-final"))}
      </div>
      <div class="bk-core">
        <div class="bk-trophy" aria-hidden="true">
          <img class="bk-cup bk-cup-img" src="./assets/wc26-logo.png" alt=""
               onerror="this.style.display='none';this.nextElementSibling.style.display='block'" />
          <span class="bk-cup-fallback" style="display:none">${TROPHY_SVG}</span>
        </div>
        <div class="bk-final-label">${t("br.final")}</div>
        ${card(final, true)}
        ${third ? `<div class="bk-third"><div class="bk-third-label">${t("br.third")}</div>${card(third, true)}</div>` : ""}
      </div>
      <div class="bk-half right">
        ${colHtml(t("br.sf"), R("Semi-final"))}
        ${colHtml(t("br.qf"), R("Quarter-final"))}
        ${colHtml(t("br.r16"), R("Round of 16"))}
        ${colHtml(t("br.r32"), R("Round of 32"))}
      </div>
    </div>`;
}

// Stylized World Cup trophy (gold, on a green marble base) — the centrepiece of
// the "road to the final". Inline SVG so it scales crisply in light/dark.
const TROPHY_SVG = `
<svg class="bk-cup" viewBox="0 0 120 172" role="img" aria-label="World Cup">
  <defs>
    <linearGradient id="wc-cup" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff2c8"/><stop offset=".45" stop-color="#eabf4d"/><stop offset="1" stop-color="#a67912"/>
    </linearGradient>
    <linearGradient id="wc-base" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2fa06a"/><stop offset="1" stop-color="#12603c"/>
    </linearGradient>
  </defs>
  <g fill="url(#wc-cup)">
    <ellipse cx="60" cy="31" rx="23" ry="25"/>
    <path d="M45 47 C 33 80, 46 110, 60 120 C 74 110, 87 80, 75 47 C 71 62, 65 65, 60 65 C 55 65, 49 62, 45 47 Z"/>
    <path d="M52 118 h16 l-3 20 h-10 z"/>
  </g>
  <path d="M33 140 q27 -11 54 0 l4 13 q-31 -10 -62 0 z" fill="url(#wc-base)"/>
  <rect x="33" y="151" width="54" height="9" rx="3.5" fill="url(#wc-cup)"/>
</svg>`;

// ---- scorers ----
export function renderScorers(list, { filtered = false } = {}) {
  const wrap = $("#scorers-list");
  if (!list.length) {
    wrap.innerHTML = `<p class="empty">${t(filtered ? "sc.none" : "empty.noGoals")}</p>`;
    return;
  }
  wrap.innerHTML = list.slice(0, 50).map((s, i) => `
    <div class="scorer clickable" role="button" tabindex="0" data-scorer-name="${esc(s.name)}" data-scorer-country="${esc(s.country)}" aria-label="${esc(s.name)} — ${esc(t("drill.detail"))}">
      <span class="rank">${s.rank ?? i + 1}</span>
      ${flagImg(s.country)}
      <span class="who"><div class="nm">${esc(s.name)}</div><div class="ct">${esc(tn(s.country))}</div></span>
      <span class="goals">${s.goals}${s.assists ? ` <small class="ast">+${s.assists}A</small>` : ""}${s.penalties ? ` <small>(${s.penalties}p)</small>` : ""}</span>
      <span class="scorer-go" aria-hidden="true">↗</span>
    </div>`).join("");
}

// Golden Boot podium — the top 3 scorers (always the full table, not filtered).
export function renderScorersPodium(list) {
  const wrap = $("#scorers-podium");
  if (!wrap) return;
  const top = (list || []).filter((s) => s.goals > 0).slice(0, 3);
  if (!top.length) { wrap.innerHTML = ""; return; }
  const medal = ["🥇", "🥈", "🥉"];
  const podium = top.map((s, i) => `
    <div class="podium-card${i === 0 ? " lead" : ""}">
      <div class="podium-medal" aria-hidden="true">${medal[i]}</div>
      ${flagImg(s.country, "flag podium-flag")}
      <div class="podium-name">${esc(s.name)}</div>
      <div class="podium-ct">${esc(tn(s.country))}</div>
      <div class="podium-goals">${s.goals} <span>${t("u.goals")}</span></div>
      ${i === 0 ? `<div class="podium-tag">🏆 ${t("sc.boot")}</div>` : ""}
    </div>`).join("");
  wrap.innerHTML = `<div class="podium-row">${podium}</div>
    <p class="podium-note">🗓️ ${t("sc.podiumNote")}</p>`;
}

// ---- venues ----
export function renderVenues() {
  const grid = $("#venues-grid");
  grid.innerHTML = Object.entries(VENUES).map(([, v]) => {
    // If the photo fails to load, swap in a branded gradient banner.
    const onerr = "this.style.display='none';this.parentElement.classList.add('noimg')";
    return `
    <article class="venue">
      <div class="venue-media" data-name="${esc(v.stadium)}">
        <img class="venue-img" src="${venuePhoto(v.img)}" alt="${esc(v.stadium)}"
             loading="lazy" referrerpolicy="no-referrer" onerror="${onerr}" />
        <span class="venue-flag">${flagImg(v.country, "flag")}</span>
        <span class="venue-glyph" aria-hidden="true">🏟️</span>
      </div>
      <div class="venue-body">
        <div class="venue-fifa">${esc(v.fifa)}</div>
        <div class="vn">${esc(v.stadium)}</div>
        <div class="vc">${esc(v.city)}, ${esc(tn(v.country))}</div>
        <div class="venue-stats">
          <div><span class="vk">${t("venue.built")}</span><span class="vv">${v.built}</span></div>
          <div><span class="vk">${t("venue.capacity")}</span><span class="vv">${fmtInt(v.capacity)}</span></div>
          <div><span class="vk">${t("venue.cost")}</span><span class="vv">${esc(v.cost)}</span></div>
        </div>
        ${(getLang() === "en" ? v.factEn : v.fact) ? `<p class="venue-fact">💡 ${esc(getLang() === "en" ? v.factEn : v.fact)}</p>` : ""}
      </div>
    </article>`;
  }).join("");
}

// ---- live status legend (cadence + last-updated) ----
function relTime(ts) {
  if (!ts) return "—";
  const en = getLang() === "en";
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  const wrap = (v) => (en ? `${v} ago` : `hace ${v}`);
  if (s < 60) return wrap(`${s}s`);
  const m = Math.round(s / 60);
  if (m < 60) return wrap(`${m} min`);
  return wrap(`${Math.round(m / 60)} h`);
}

export function renderLiveStatus({ provider, updatedAt, intervalMin }) {
  const el = document.getElementById("live-status");
  if (!el) return;
  const src = provider ? t("live.srcOn") : t("live.srcOff");
  el.innerHTML = `
    <span class="live-status-dot ${provider ? "on" : ""}"></span>
    <span class="live-status-txt">${t("live.source")}: <b>${src}</b> · ${t("live.everyPre")} ${intervalMin} min</span>
    <span class="live-status-ago">${t("live.updated")} ${relTime(updatedAt)}</span>`;
}

// ---- home live centre: the live scoreboard, shown only while a match plays ----
export function renderHomeLive(matches) {
  const sec = document.getElementById("home-live");
  if (!sec) return;
  const live = (matches || []).filter((m) => m.status === "live");
  if (!live.length) { sec.hidden = true; sec.innerHTML = ""; return; }
  sec.hidden = false;
  sec.innerHTML = `
    <div class="section-head">
      <p class="kicker live-kick"><span class="live-status-dot on"></span>${t("live.kicker")}</p>
      <h3 class="section-title">${t("live.nowTitle")}</h3>
    </div>
    <div class="live-feed">${live.map(liveCard).join("")}</div>`;
}

// ---- live match centre ----
export function renderLive(matches, upcomingSource = matches) {
  const wrap = $("#live-feed");
  if (!wrap) return;
  const live = matches.filter((m) => m.status === "live");

  if (live.length) {
    wrap.innerHTML = live.map(liveCard).join("");
    return;
  }
  // Nothing live → show the next kickoffs with a countdown.
  const upcoming = upcomingSource.filter((m) => m.status === "scheduled").slice(0, 4);
  wrap.innerHTML = `
    <div class="live-empty card">
      <div class="live-empty-dot"></div>
      <div>
        <h3>${t("live.none")}</h3>
        <p class="section-sub" style="margin:.2rem 0 0">${t("live.noneSub")}</p>
      </div>
    </div>
    ${upcoming.length ? `<h3 class="section-title">${t("live.next")}</h3>
    <div class="match-list">${upcoming.map(upcomingCard).join("")}</div>` : ""}`;
}

function venueFifa(ground) {
  const v = VENUES[ground];
  return v ? `${v.fifa} · ${v.city}` : esc(ground || "");
}

function goalTimeline(m, side) {
  const gs = (m.goals || []).filter((g) => g.team === side);
  if (!gs.length) return `<li class="empty-goal">—</li>`;
  return gs.map((g) =>
    `<li>${esc(g.name)} <span class="gm">${g.minute}'${g.penalty ? " (p)" : ""}</span></li>`).join("");
}

function liveCard(m) {
  const h = m.score?.home ?? 0, a = m.score?.away ?? 0;
  const clock = m.clock || (m.elapsed != null ? `${m.elapsed}'` : t("badge.live"));

  // Optional live statistics row (only when the provider supplies them).
  let statsRow = "";
  const sh = m.stats?.home, sa = m.stats?.away;
  if (sh && sa && (sh.fouls != null || sh.shots != null)) {
    const stat = (label, hv, av) => `
      <div class="ls-row"><span class="ls-h">${hv ?? "–"}</span><span class="ls-k">${label}</span><span class="ls-a">${av ?? "–"}</span></div>`;
    statsRow = `<div class="live-stats">
      ${stat(t("live.shots"), sh.shots, sa.shots)}
      ${stat(t("live.fouls"), sh.fouls, sa.fouls)}
    </div>`;
  }

  return `
  <article class="live-card">
    <div class="live-top">
      <span class="badge live">● ${esc(clock)}</span>
      <span class="live-round">${esc(m.round)}</span>
    </div>
    <div class="live-score">
      <div class="lt home">${flagImg(m.home.name)}<span class="nm">${esc(tn(m.home.name))}</span></div>
      <div class="lsc">${h} <span>–</span> ${a}</div>
      <div class="lt away"><span class="nm">${esc(tn(m.away.name))}</span>${flagImg(m.away.name)}</div>
    </div>
    <div class="live-goals">
      <ul class="gl home">${goalTimeline(m, "home")}</ul>
      <span class="gl-ball" aria-hidden="true">⚽</span>
      <ul class="gl away">${goalTimeline(m, "away")}</ul>
    </div>
    ${statsRow}
    <div class="live-venue">📍 ${venueFifa(m.ground)}</div>
  </article>`;
}

function upcomingCard(m) {
  const venue = m.ground ? `<div class="meta venue-meta">📍 ${esc(venueFifa(m.ground))}</div>` : "";
  return `
  <div class="match has-venue">
    <div class="side home">${flagImg(m.home.name)}<span class="nm">${esc(tn(m.home.name))}</span></div>
    <div class="center">
      <span class="badge up">${t("badge.up")}</span>
      <div class="meta">${esc(kickoffDateTime(m) || kickoffLabel(m) || t("tbd"))}</div>
      ${venue}
    </div>
    <div class="side away">${flagImg(m.away.name)}<span class="nm">${esc(tn(m.away.name))}</span></div>
  </div>`;
}

// ---- stats KPIs ----
export function renderStatsKpis(stats, matches) {
  const finished = matches.filter((m) => m.status === "finished").length;
  const live = matches.filter((m) => m.status === "live").length;
  const kpis = [
    [t("s.played"), stats.played],
    [t("s.goalsTotal"), stats.goals],
    [t("s.avg"), stats.avg ? stats.avg.toFixed(2) : "0.00"],
    [t("s.live"), live],
    [t("s.finished"), finished],
    [t("s.remaining"), matches.length - finished],
  // Hide zero-value cards (e.g. "0 en vivo", "0 restantes") — no empty metrics.
  ].filter(([, n]) => Number(String(n).replace(/,/g, "")) !== 0);
  $("#stats-kpis").innerHTML = kpis.map(([l, n]) =>
    `<div class="stat"><div class="num">${fmtInt(n)}</div><div class="label">${l}</div></div>`).join("");
}

// ---- curated tournament aggregates (offsides, cards, VAR, …) ----
export function renderAggregates(facts) {
  const a = facts.aggregates || {};
  const att = facts.attendanceInfo || { total: a.attendance, isEstimate: true, matches: 0 };
  // [icon, label, value, badge, varKey] — varKey makes the card clickable.
  const items = [
    ["🚩", t("a.offsides"), a.offsides],
    ["🚫", t("a.disallowed"), a.disallowedGoals, "", "disallowed"],
    ["✅", t("a.restored"), a.varRestoredGoals, "", "restored"],
    ["📺", t("a.var"), a.varReviews],
    ["🎯", t("a.pens"), a.penaltiesAwarded],
    ["🟨", t("a.yellow"), a.yellowCards],
    ["🟥", t("a.red"), a.redCards],
    ["⚠️", t("a.fouls"), a.fouls],
    ["📐", t("a.corners"), a.corners],
    ["🧤", t("a.saves"), a.saves],
    ["👥", t("a.attendance"), att.total, att.isEstimate ? t("a.estBadge") : ""],
  ];
  const grid = document.getElementById("agg-grid");
  if (!grid) return;
  grid.innerHTML = items.map(([icon, label, val, badge, varKey]) => `
    <div class="stat agg${varKey ? " clickable" : ""}"${varKey ? ` data-var="${varKey}" role="button" tabindex="0" aria-label="${esc(label)} — ${esc(t("drill.detail"))}"` : ""}>
      <div class="agg-icon" aria-hidden="true">${icon}</div>
      <div class="num">${val == null ? "—" : fmtInt(val)}${badge ? ` <span class="est-badge">${badge}</span>` : ""}</div>
      <div class="label">${label}</div>
      ${varKey ? `<span class="fact-go" aria-hidden="true">↗</span>` : ""}
    </div>`).join("");

  // Attendance integrity note.
  const foot = document.getElementById("agg-foot");
  if (foot) {
    foot.textContent = att.isEstimate
      ? t("a.attEstNote")
      : `${t("a.attRealNote")} (${att.matches} ${t("u.matches")}).`;
  }
}

// ---- added (stoppage) time: avg/match + WC references + per-phase totals ----
export function renderAddedTime(facts) {
  const at = facts.addedTime;
  const wrap = document.getElementById("addedtime");
  if (!wrap || !at) return;
  const min = (v) => `${Number(v).toFixed(1)}'`;
  const minInt = (v) => `${fmtInt(v)}'`;
  wrap.innerHTML = `
    <div class="at-main">
      <div class="at-big">${min(at.avgPerMatch)}</div>
      <div class="at-cap">${t("at.avg")}${at.isEstimate ? ` <span class="est-badge">${t("a.estBadge")}</span>` : ""}</div>
    </div>
    <div class="at-refs">
      <div class="at-ref"><span class="atr-k">🇷🇺 2018</span><span class="atr-v">${min(at.ref.wc2018)}</span></div>
      <div class="at-ref"><span class="atr-k">🇶🇦 2022</span><span class="atr-v">${min(at.ref.wc2022)}</span></div>
    </div>
    <div class="at-phases">
      <div class="at-phase"><span class="atp-k">${t("at.groups")}</span><span class="atp-v">${minInt(at.byPhase.groups)}</span></div>
      <div class="at-phase"><span class="atp-k">${t("at.knockouts")}</span><span class="atp-v">${minInt(at.byPhase.knockouts)}</span></div>
      <div class="at-phase total"><span class="atp-k">${t("at.total")}</span><span class="atp-v">${minInt(at.byPhase.groups + at.byPhase.knockouts)}</span></div>
    </div>`;
}

// ---- derived "bizarre" facts cards ----
export function renderFacts(facts) {
  const wrap = document.getElementById("facts-grid");
  if (!wrap) return;

  const pair = (m) => m ? `${esc(tn(m.home.name))} vs ${esc(tn(m.away.name))}` : "—";
  const cards = [];

  if (facts.highest)
    cards.push(fact("🔥", t("f.highest"),
      `${facts.highest.total} ${t("u.goals")}`, `${pair(facts.highest.m)} (${facts.highest.score})`, "highest"));
  if (facts.biggest)
    cards.push(fact("💥", t("f.biggest"),
      `${facts.biggest.margin} ${t("f.diff")}`, `${pair(facts.biggest.m)} (${facts.biggest.score})`, "biggest"));
  if (facts.fastest)
    cards.push(fact("⚡", t("f.fastest"),
      `${t("f.min")} ${facts.fastest.min}'`, esc(facts.fastest.name || "—"), "fastest"));
  if (facts.latest)
    cards.push(fact("⏱️", t("f.latest"),
      `${t("f.min")} ${facts.latest.min}'`, esc(facts.latest.name || "—"), "latest"));

  cards.push(fact("🎩", t("f.hattricks"),
    String(facts.hatTricks.length),
    facts.hatTricks.length ? esc(facts.hatTricks[0].name) + (facts.hatTricks.length > 1 ? t("f.andMore") : "") : t("f.none"),
    facts.hatTricks.length ? "hattricks" : null));
  cards.push(fact("🔄", t("f.comebacks"), String(facts.comebacks), t("f.dmComeback"), facts.comebacks ? "comebacks" : null));
  cards.push(fact("🥅", t("f.shootouts"), String(facts.shootouts), t("f.dmShootout"), facts.shootouts ? "shootouts" : null));
  cards.push(fact("🧱", t("f.cleansheets"), String(facts.cleanSheets), t("f.dmClean"), facts.cleanSheets ? "cleansheets" : null));
  cards.push(fact("🥱", t("f.zerozero"), String(facts.zeroZero), t("f.dmZero"), facts.zeroZero ? "zeroZero" : null));
  cards.push(fact("🏟️", t("f.blowouts"), String(facts.blowouts), t("f.dmBlow"), facts.blowouts ? "blowouts" : null));
  cards.push(fact("🎯", t("f.pengoals"), String(facts.penaltyGoals), t("f.dmPen"), facts.penaltyGoals ? "pengoals" : null));
  if (facts.topTeams[0]) {
    // Most goals scored — include every selección tied at the top.
    const maxG = facts.topTeams[0].goals;
    const leaders = facts.topTeams.filter((x) => x.goals === maxG);
    const names = leaders.map((x) => esc(tn(x.name))).join(" · ");
    cards.push(fact("👑", t("f.topattack"), `${maxG} ${t("u.goals")}`, names, "topattack"));
  }

  wrap.innerHTML = cards.join("");
}

function fact(icon, label, value, detail, key = null) {
  const interactive = key
    ? ` data-fact="${key}" role="button" tabindex="0" aria-label="${esc(label)} — ${esc(t("drill.detail"))}"`
    : "";
  return `
  <div class="fact${key ? " clickable" : ""}"${interactive}>
    <div class="fact-icon" aria-hidden="true">${icon}</div>
    <div class="fact-body">
      <div class="fact-value">${value}</div>
      <div class="fact-label">${label}</div>
      <div class="fact-detail">${detail}</div>
    </div>
    ${key ? `<span class="fact-go" aria-hidden="true">↗</span>` : ""}
  </div>`;
}

// ---- discipline & shooting efficacy ----
export function renderDiscipline(disc) {
  const kpiWrap = document.getElementById("disc-kpis");
  if (kpiWrap) {
    const mf = disc.mostFouls, le = disc.leastEfficacy, me = disc.mostEfficacy;
    const cards = [];
    if (mf) cards.push(`
      <div class="fact">
        <div class="fact-icon">⚠️</div>
        <div class="fact-body">
          <div class="fact-value">${mf.perMatch.toFixed(1)} ${t("d.foulsPerMatch")}</div>
          <div class="fact-label">${t("d.mostFouls")}</div>
          <div class="fact-detail">${flagImg(mf.name)} ${esc(tn(mf.name))} · ${fmtInt(mf.fouls)} ${t("u.fouls")} / ${mf.matches}</div>
        </div>
      </div>`);
    if (me) cards.push(`
      <div class="fact">
        <div class="fact-icon">🎯</div>
        <div class="fact-body">
          <div class="fact-value">${me.pct.toFixed(0)}%</div>
          <div class="fact-label">${t("d.mostEff")}</div>
          <div class="fact-detail">${flagImg(me.name)} ${esc(tn(me.name))} · ${me.goals}/${me.shots} ${t("u.shots")}</div>
        </div>
      </div>`);
    if (le) cards.push(`
      <div class="fact">
        <div class="fact-icon">🥅</div>
        <div class="fact-body">
          <div class="fact-value">${le.pct.toFixed(0)}%</div>
          <div class="fact-label">${t("d.leastEff")}</div>
          <div class="fact-detail">${flagImg(le.name)} ${esc(tn(le.name))} · ${le.goals}/${le.shots} ${t("u.shots")}</div>
        </div>
      </div>`);
    kpiWrap.innerHTML = cards.join("");
  }

  // Top-10 fouls-per-match table.
  const tbl = document.getElementById("fouls-table");
  if (tbl) {
    const rows = disc.foulsRanking.slice(0, 10);
    tbl.innerHTML = `
      <table class="rank-table">
        <thead><tr><th>#</th><th style="text-align:left">${t("st.team")}</th><th>${t("d.foulsPerMatch")}</th></tr></thead>
        <tbody>${rows.map((r, i) => `
          <tr>
            <td class="rk">${i + 1}</td>
            <td class="team">${flagImg(r.name)}<span>${esc(tn(r.name))}</span></td>
            <td class="val">${r.perMatch.toFixed(1)}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;
  }

  // Red cards + serious injuries KPIs.
  const rcWrap = document.getElementById("rc-kpis");
  if (rcWrap) {
    const cards = [];
    cards.push(`
      <div class="fact">
        <div class="fact-icon">🟥</div>
        <div class="fact-body">
          <div class="fact-value">${fmtInt(disc.redTotal || 0)}</div>
          <div class="fact-label">${t("rc.total")}</div>
          <div class="fact-detail">${(disc.redByTeam || []).slice(0, 3).map((x) => `${esc(tn(x.name))} (${x.red})`).join(" · ") || "—"}</div>
        </div>
      </div>`);
    const inj = disc.injuries || [];
    cards.push(`
      <div class="fact">
        <div class="fact-icon">🩹</div>
        <div class="fact-body">
          <div class="fact-value">${fmtInt(inj.length)}</div>
          <div class="fact-label">${t("rc.injuries")}</div>
          <div class="fact-detail">${t("rc.injuriesCap")}</div>
        </div>
      </div>`);
    rcWrap.innerHTML = cards.join("");
  }

  // Serious injuries list.
  const injWrap = document.getElementById("injuries-list");
  if (injWrap) {
    const inj = disc.injuries || [];
    injWrap.innerHTML = inj.length
      ? inj.map((x) => `
        <div class="injury">
          ${flagImg(x.team)}
          <div class="inj-body"><div class="inj-name">${esc(x.player)} <span class="inj-team">· ${esc(tn(x.team))}</span></div>
            <div class="inj-kind">${esc(x.kind)}${x.date ? ` · ${esc(x.date)}` : ""}</div></div>
        </div>`).join("")
      : `<p class="archive-empty">${t("empty.noResults")}</p>`;
  }
}

// ---- goalkeeping: best shot-stoppers (save %) + clean sheets ----
export function renderGoalkeeping(disc) {
  const gk = disc.goalkeeping || [];
  const kpiWrap = document.getElementById("gk-kpis");
  if (kpiWrap) {
    if (!gk.length) {
      kpiWrap.innerHTML = `<p class="archive-empty">${t("gk.none")}</p>`;
    } else {
      const best = gk[0];
      const mostSaves = [...gk].sort((a, b) => b.saves - a.saves)[0];
      const mostClean = [...gk].sort((a, b) => b.cleanSheets - a.cleanSheets)[0];
      const cards = [];
      cards.push(fact("🧤", t("gk.best"), `${Math.round(best.savePct)}%`,
        `${flagImg(best.name)} ${esc(tn(best.name))} · ${best.saves}/${best.faced} ${t("gk.stops")}`));
      cards.push(fact("✋", t("gk.mostSaves"), fmtInt(mostSaves.saves),
        `${flagImg(mostSaves.name)} ${esc(tn(mostSaves.name))}`));
      if (mostClean && mostClean.cleanSheets > 0)
        cards.push(fact("🛡️", t("gk.mostClean"), String(mostClean.cleanSheets),
          `${flagImg(mostClean.name)} ${esc(tn(mostClean.name))}`));
      kpiWrap.innerHTML = cards.join("");
    }
  }
  const cleanWrap = document.getElementById("gk-clean");
  if (cleanWrap) {
    const cs = [...gk].filter((g) => g.cleanSheets > 0)
      .sort((a, b) => b.cleanSheets - a.cleanSheets || b.savePct - a.savePct).slice(0, 8);
    cleanWrap.innerHTML = cs.length
      ? cs.map((g, i) => `<div class="gk-row"><span class="gk-rk">${i + 1}</span>${flagImg(g.name)}<span class="gk-nm">${esc(tn(g.name))}</span><span class="gk-cs">${g.cleanSheets}</span></div>`).join("")
      : `<p class="archive-empty">${t("gk.none")}</p>`;
  }
}

// ---- penalty shootouts: each duel + a per-team record ----
export function renderShootouts(pk) {
  const wrap = document.getElementById("pk-wrap");
  if (!wrap) return;
  if (!pk || !pk.total) { wrap.innerHTML = `<p class="archive-empty">${t("pk.none")}</p>`; return; }
  const cards = pk.list.map((s) => {
    const homeWon = s.winner === s.home;
    return `<div class="pk-card">
      <div class="pk-round">${esc(roundLabel(s.round))}</div>
      <div class="pk-duel">
        <div class="pk-team ${homeWon ? "win" : ""}">${flagImg(s.home)}<span class="pk-tn">${esc(tn(s.home))}</span></div>
        <div class="pk-score">${s.penHome}<span>–</span>${s.penAway}</div>
        <div class="pk-team right ${!homeWon ? "win" : ""}"><span class="pk-tn">${esc(tn(s.away))}</span>${flagImg(s.away)}</div>
      </div>
      <div class="pk-foot"><span>${t("pk.aet")} ${s.level}</span><span class="pk-win">🏆 ${esc(tn(s.winner))}</span></div>
    </div>`;
  }).join("");
  const lead = pk.teams.slice(0, 6).map((tt, i) => `
    <div class="pk-lrow"><span class="pk-rk">${i + 1}</span>${flagImg(tt.name)}<span class="pk-lnm">${esc(tn(tt.name))}</span>
      <span class="pk-rec"><b class="ok">${tt.won}</b>${t("pk.w")} · <b class="no">${tt.lost}</b>${t("pk.l")} · ${tt.scored} ${t("pk.scored")}</span></div>`).join("");
  wrap.innerHTML = `<div class="pk-grid">${cards}</div>
    <div class="pk-board"><div class="pk-board-h">${t("pk.record")}</div>${lead}</div>`;
}

// ---- generic info modal (custom HTML body) ----
export function openInfoModal({ title, html }) {
  closeModal();
  modalReturnFocus = document.activeElement;
  const ov = document.createElement("div");
  ov.id = "drill-modal";
  ov.className = "modal-overlay";
  ov.setAttribute("role", "dialog");
  ov.setAttribute("aria-modal", "true");
  ov.setAttribute("aria-labelledby", "modal-title");
  ov.innerHTML = `
    <div class="modal-card" role="document">
      <button class="modal-x" aria-label="${esc(t("drill.close"))}">✕</button>
      <div class="modal-head"><div><h3 id="modal-title">${esc(title)}</h3></div></div>
      <div class="modal-body">${html}</div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector(".modal-x").addEventListener("click", closeModal);
  ov.addEventListener("click", (e) => { if (e.target === ov) closeModal(); });
  document.addEventListener("keydown", modalKeys);
  ov.querySelector(".modal-x").focus();
  return ov;
}

// ---- drill-down modal (tap a chart bar → detail) ----
let modalReturnFocus = null;
export function openModal({ title, subtitle, flagTeam, rows = [], matches = [] }) {
  closeModal();
  modalReturnFocus = document.activeElement; // restore on close
  const ov = document.createElement("div");
  ov.id = "drill-modal";
  ov.className = "modal-overlay";
  ov.setAttribute("role", "dialog");
  ov.setAttribute("aria-modal", "true");
  ov.setAttribute("aria-labelledby", "modal-title");
  const stat = ([k, v]) => `<div class="modal-stat"><span class="ms-k">${esc(k)}</span><span class="ms-v">${v}</span></div>`;
  const matchRows = matches.length
    ? `<div class="modal-matches"><div class="mm-h">${t("drill.matches")}</div>${matches.map(matchMini).join("")}</div>`
    : "";
  ov.innerHTML = `
    <div class="modal-card" role="document">
      <button class="modal-x" aria-label="${esc(t("drill.close"))}">✕</button>
      <div class="modal-head">${flagTeam ? flagImg(flagTeam, "flag modal-flag") : ""}
        <div><h3 id="modal-title">${esc(title)}</h3>${subtitle ? `<p class="modal-sub">${esc(subtitle)}</p>` : ""}</div></div>
      ${rows.length ? `<div class="modal-stats">${rows.map(stat).join("")}</div>` : ""}
      ${matchRows || (!rows.length ? `<p class="empty">${t("drill.noData")}</p>` : "")}
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector(".modal-x").addEventListener("click", closeModal);
  ov.addEventListener("click", (e) => { if (e.target === ov) closeModal(); });
  document.addEventListener("keydown", modalKeys);
  ov.querySelector(".modal-x").focus();
}
// Esc closes; Tab is trapped within the dialog.
function modalKeys(e) {
  if (e.key === "Escape") { closeModal(); return; }
  if (e.key !== "Tab") return;
  const card = document.querySelector("#drill-modal .modal-card");
  if (!card) return;
  const f = card.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])');
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
export function closeModal() {
  const ov = document.getElementById("drill-modal");
  if (!ov) return;
  ov.remove();
  document.removeEventListener("keydown", modalKeys);
  if (modalReturnFocus && typeof modalReturnFocus.focus === "function") modalReturnFocus.focus();
  modalReturnFocus = null;
}
function matchMini(m) {
  const hasScore = m.score && m.score.home != null;
  const mid = hasScore ? `${m.score.home}–${m.score.away}` : (kickoffLabel(m) || t("tbd"));
  return `<div class="mm-row">
    <span class="mm-t">${esc(tn(m.home.name))}</span>
    <span class="mm-s">${esc(mid)}</span>
    <span class="mm-t right">${esc(tn(m.away.name))}</span></div>`;
}

// ---- social: X timeline + optional widget + per-matchday Instagram archive ----
export function renderSocial() {
  const wrap = document.getElementById("social-wrap");
  if (!wrap || wrap.dataset.ready) return;
  wrap.dataset.ready = "1";

  // Optional live Instagram feed via a third-party widget (LightWidget / Behold).
  const widgetUrl = (CONFIG.SOCIAL_WIDGET_URL || "").trim();
  const widget = widgetUrl
    ? `<div class="card social-card wide">
         <h3 data-i18n="social.igFeed">${t("social.igFeed")}</h3>
         <div class="social-embed"><iframe class="lw-iframe" src="${esc(widgetUrl)}" title="Instagram feed"
            loading="lazy" allowtransparency="true" frameborder="0" scrolling="no"></iframe></div>
         <a class="social-link" href="https://www.instagram.com/fifaworldcup/" target="_blank" rel="noopener" data-i18n="social.openIg">${t("social.openIg")}</a>
       </div>`
    : "";

  // data-i18n on the static labels so applyStatic() retranslates them on toggle
  // (this block is injected once and not re-rendered).
  wrap.innerHTML = `
    <div class="social-grid">
      <div class="card social-card">
        <h3 translate="no">𝕏 · @FIFAWorldCup</h3>
        <div class="social-embed">
          <a class="twitter-timeline" data-theme="dark" data-height="520" data-chrome="noheader nofooter transparent"
             href="https://twitter.com/FIFAWorldCup?ref_src=twsrc%5Etfw" data-i18n="social.xPosts">${t("social.xPosts")}</a>
        </div>
        <a class="social-link" href="https://x.com/FIFAWorldCup" target="_blank" rel="noopener" data-i18n="social.openX">${t("social.openX")}</a>
      </div>
      ${widget}
    </div>
    <div class="section-head" style="margin-top:1.6rem">
      <p class="kicker" data-i18n="social.archiveK">${t("social.archiveK")}</p>
      <h3 class="section-title" data-i18n="social.archiveT">${t("social.archiveT")}</h3>
      <p class="section-sub" data-i18n="social.archiveS">${t("social.archiveS")}</p>
    </div>
    <div id="social-archive" class="social-archive"></div>`;

  loadScript("https://platform.twitter.com/widgets.js", () => window.twttr?.widgets?.load(wrap));
  loadScript("https://www.instagram.com/embed.js", () => window.instgrm?.Embeds?.process());

  // Fallback: if the X widget didn't inject an iframe (blocked/offline), show a
  // clear "open in app" note instead of an empty box.
  setTimeout(() => {
    const box = wrap.querySelector(".social-card .social-embed");
    if (box && !box.querySelector("iframe")) {
      box.insertAdjacentHTML("beforeend",
        `<p class="social-fallback"><a href="https://x.com/FIFAWorldCup" target="_blank" rel="noopener">${t("social.fail")}</a></p>`);
    }
  }, 4000);
}

// Per-day / per-venue Instagram archive, auto-built from played fixtures.
// `social` maps "YYYY-MM-DD" -> [permalink | {permalink}] of curated IG posts.
export function renderSocialArchive(matches, social = {}) {
  const wrap = document.getElementById("social-archive");
  if (!wrap) return;
  const today = new Date().toISOString().slice(0, 10);

  const byDate = new Map();
  for (const m of matches) {
    if (!m.date || m.date > today) continue;
    if (!byDate.has(m.date)) byDate.set(m.date, []);
    byDate.get(m.date).push(m);
  }
  const dates = [...byDate.keys()].sort().reverse();
  if (!dates.length) { wrap.innerHTML = `<p class="empty">${t("arch.none")}</p>`; return; }

  wrap.innerHTML = dates.map((date, idx) => {
    const games = byDate.get(date);
    const venues = [...new Set(games.map((g) => g.ground).filter(Boolean))];
    const chips = venues.map((g) => {
      const info = VENUES[g];
      const stad = info ? info.stadium : g;
      const tag = stad.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
      return `<a class="venue-chip" href="https://www.instagram.com/explore/tags/${tag}/" target="_blank" rel="noopener">📍 ${esc(stad)}</a>`;
    }).join("");
    const posts = social[date] || [];
    const embeds = posts.length
      ? `<div class="ig-posts">${posts.map(igEmbed).join("")}</div>`
      : `<p class="archive-empty">${t("arch.empty")}</p>`;
    return `
      <details class="archive-day"${idx === 0 ? " open" : ""}>
        <summary>
          <span class="ad-date">${fmtDateLong(date)}</span>
          <span class="ad-count">${games.length} ${t("u.matches")} · ${venues.length} ${t("u.venues")}</span>
        </summary>
        <div class="archive-venues">${chips}</div>
        ${embeds}
      </details>`;
  }).join("");

  if (window.instgrm?.Embeds) window.instgrm.Embeds.process();
}

function igEmbed(p) {
  const url = typeof p === "string" ? p : (p && p.permalink) || "";
  if (!url) return "";
  return `<blockquote class="instagram-media" data-instgrm-permalink="${esc(url)}"
    data-instgrm-version="14" style="max-width:540px;width:100%"></blockquote>`;
}
function fmtDateLong(d) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString(getLang() === "en" ? "en-US" : "es-MX",
    { weekday: "long", day: "numeric", month: "long" });
}

function loadScript(src, onload) {
  if (document.querySelector(`script[src="${src}"]`)) { onload?.(); return; }
  const s = document.createElement("script");
  s.src = src; s.async = true; s.onload = onload;
  document.body.appendChild(s);
}

// ---- editorial hero lead (key numbers in one line) ----
// Next-match countdown card in the hero.
export function renderHeroNext(matches) {
  const el = $("#hero-next");
  if (!el) return;
  const now = Date.now();
  const next = (matches || [])
    .filter((m) => m.status === "scheduled" && kickoffDate(m) && kickoffDate(m).getTime() > now)
    .sort((a, b) => kickoffDate(a) - kickoffDate(b))[0];
  if (!next) { el.innerHTML = ""; delete el.dataset.ts; return; }
  el.dataset.ts = String(kickoffDate(next).getTime());
  el.innerHTML = `
    <div class="hn-label">${t("hero.next")}</div>
    <div class="hn-match">
      ${flagImg(next.home.name, "flag", { eager: true })}<span class="hn-team">${esc(tn(next.home.name))}</span>
      <span class="hn-vs">vs</span>
      <span class="hn-team">${esc(tn(next.away.name))}</span>${flagImg(next.away.name, "flag", { eager: true })}
    </div>
    <div class="hn-count" id="hero-count"></div>
    <div class="hn-meta">${esc(kickoffDateTime(next) || "")}${next.ground ? ` · 📍 ${esc(venueFifa(next.ground))}` : ""}</div>`;
  tickHeroCountdown();
}

export function tickHeroCountdown() {
  const host = $("#hero-next"), el = $("#hero-count");
  if (!el || !host?.dataset.ts) return;
  const diff = Number(host.dataset.ts) - Date.now();
  if (diff <= 0) { el.textContent = t("hero.live"); return; }
  const pad = (n) => String(n).padStart(2, "0");
  const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000),
    m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
  el.innerHTML = (d > 0 ? `<span class="hc-u"><b>${d}</b>d</span>` : "") +
    `<span class="hc-u"><b>${pad(h)}</b>h</span><span class="hc-u"><b>${pad(m)}</b>m</span><span class="hc-u"><b>${pad(s)}</b>s</span>`;
}

export function renderHeroLead(stats) {
  const el = document.getElementById("hero-lead");
  if (!el) return;
  if (!stats || !stats.played) { el.textContent = ""; return; }
  const en = getLang() === "en";
  const p = `<strong>${fmtInt(stats.played)}</strong>`, g = `<strong>${fmtInt(stats.goals)}</strong>`,
    a = `<strong>${stats.avg.toFixed(2)}</strong>`;
  el.innerHTML = en
    ? `${p} matches played · ${g} goals · ${a} per match.`
    : `${p} partidos jugados · ${g} goles · ${a} por partido.`;
}

// ---- insight strip: big number + context (data-journalism style) ----
export function renderInsightStrip(stats, facts, disc) {
  const el = document.getElementById("insight-strip");
  if (!el) return;
  const card = (big, cap, mod = "") =>
    `<div class="insight ${mod}"><div class="big">${big}</div><div class="cap">${cap}</div></div>`;
  const en = getLang() === "en";
  const out = [];

  if (stats && stats.played)
    out.push(card(stats.avg.toFixed(2), en
      ? `goals per match across <b>${fmtInt(stats.played)}</b> matches played`
      : `goles por partido en <b>${fmtInt(stats.played)}</b> partidos disputados`));
  const top = facts?.topTeams || [];
  if (top.length) {
    const maxG = top[0].goals;
    const names = top.filter((x) => x.goals === maxG).map((x) => esc(tn(x.name))).join(en ? " & " : " y ");
    out.push(card(fmtInt(maxG), en
      ? `goals by <b>${names}</b>, the team with the most goals`
      : `goles de <b>${names}</b>, la selección con más goles`, "gold"));
  }
  if (facts?.highest)
    out.push(card(fmtInt(facts.highest.total), (en
      ? `goals in the wildest game: `
      : `goles en el duelo más loco: `) +
      `<b>${esc(tn(facts.highest.m.home.name))} ${facts.highest.score} ${esc(tn(facts.highest.m.away.name))}</b>`));
  const foul = disc?.foulsRanking?.[0];
  if (foul)
    out.push(card(foul.perMatch.toFixed(1), en
      ? `fouls per match by <b>${esc(tn(foul.name))}</b>, the most aggressive`
      : `faltas por partido de <b>${esc(tn(foul.name))}</b>, la más infractora`, "live"));

  el.innerHTML = out.join("");
}

// Small count-up animation for overview numbers.
export function animateCounts(root = document) {
  for (const el of root.querySelectorAll("[data-count]")) {
    const target = parseFloat(el.dataset.count);
    if (Number.isNaN(target) || target > 1000) continue;
    const isInt = Number.isInteger(target);
    let cur = 0;
    const step = Math.max(1, Math.ceil(target / 28));
    const tick = () => {
      cur = Math.min(target, cur + step);
      el.textContent = isInt ? fmtInt(cur) : cur;
      if (cur < target) requestAnimationFrame(tick);
    };
    tick();
  }
}
