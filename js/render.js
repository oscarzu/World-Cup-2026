// render.js — pure DOM rendering helpers. No data fetching here.

import { VENUES } from "./config.js";
import { flagUrl } from "./api.js";

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function flagImg(team, cls = "flag") {
  const url = flagUrl(team);
  return url
    ? `<img class="${cls}" src="${url}" alt="" loading="lazy" />`
    : `<span class="${cls}" aria-hidden="true"></span>`;
}

const STATUS = {
  live: { cls: "live", label: "En vivo" },
  finished: { cls: "ft", label: "Final" },
  scheduled: { cls: "up", label: "Próximo" },
};

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
}

// ---- match card ----
export function matchCard(m, { showGoals = true } = {}) {
  const st = STATUS[m.status] || STATUS.scheduled;
  const hasScore = m.score && m.score.home != null;
  const center = hasScore
    ? `<div class="score">${m.score.home} – ${m.score.away}</div>`
    : `<div class="meta">${esc(m.time || "Por definir")}</div>`;
  const pen = m.score?.penHome != null
    ? `<div class="meta">pen. ${m.score.penHome}–${m.score.penAway}</div>` : "";

  let goals = "";
  if (showGoals && m.goals?.length) {
    const h = m.goals.filter((g) => g.team === "home")
      .map((g) => `${esc(g.name)} ${g.minute}'${g.penalty ? " (p)" : ""}`).join(", ");
    const a = m.goals.filter((g) => g.team === "away")
      .map((g) => `${esc(g.name)} ${g.minute}'${g.penalty ? " (p)" : ""}`).join(", ");
    goals = `<div class="goal-line">⚽ ${h || "—"} &nbsp;·&nbsp; ${a || "—"}</div>`;
  }

  return `
  <div class="match ${m.status === "live" ? "is-live" : ""}">
    <div class="side home">${flagImg(m.home.name)}<span class="nm">${esc(m.home.name)}</span></div>
    <div class="center">
      <span class="badge ${st.cls}">${st.label}</span>
      ${center}${pen}
    </div>
    <div class="side away">${flagImg(m.away.name)}<span class="nm">${esc(m.away.name)}</span></div>
    ${goals}
  </div>`;
}

// ---- overview ----
export function renderOverview(matches, stats, tournament) {
  $("#hero-dates").textContent =
    `11 jun – 19 jul 2026 · ${tournament.hosts.join(" · ")}`;

  const kpis = [
    ["Selecciones", tournament.teams],
    ["Grupos", tournament.groups],
    ["Partidos", tournament.matches],
    ["Sedes", tournament.stadiums],
    ["Goles", stats.goals],
    ["Goles/partido", stats.avg ? stats.avg.toFixed(2) : "0.00"],
  ];
  $("#overview-stats").innerHTML = kpis.map(([l, n]) =>
    `<div class="stat"><div class="num" data-count="${n}">${n}</div><div class="label">${l}</div></div>`
  ).join("");

  // Live + next 5 upcoming.
  const live = matches.filter((m) => m.status === "live");
  const upcoming = matches.filter((m) => m.status === "scheduled").slice(0, 6 - live.length);
  const list = [...live, ...upcoming];
  $("#overview-live").innerHTML = list.length
    ? list.map((m) => matchCard(m, { showGoals: false })).join("")
    : `<p class="empty">No hay partidos próximos en la programación.</p>`;
}

// ---- matches tab ----
export function renderMatches(matches) {
  const wrap = $("#match-list");
  if (!matches.length) { wrap.innerHTML = `<p class="empty">Sin resultados.</p>`; return; }
  let html = "", lastDay = "";
  for (const m of matches) {
    if (m.date !== lastDay) { html += `<div class="day-sep">${fmtDate(m.date)} — ${esc(m.round)}</div>`; lastDay = m.date; }
    html += matchCard(m);
  }
  wrap.innerHTML = html;
}

export function fillMatchFilter(matches) {
  const sel = $("#match-filter");
  const rounds = [...new Set(matches.map((m) => m.round))];
  sel.innerHTML = `<option value="">Todas las fases</option>` +
    rounds.map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join("");
}

// ---- standings ----
export function renderStandings(groupsMap) {
  const grid = $("#groups-grid");
  if (!groupsMap.size) { grid.innerHTML = `<p class="empty">Aún sin partidos jugados.</p>`; return; }
  grid.innerHTML = [...groupsMap.entries()].map(([g, rows]) => `
    <div class="group-card">
      <h3>${esc(g)}</h3>
      <table class="standings">
        <thead><tr><th class="team" style="text-align:left">Equipo</th>
          <th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th></tr></thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr class="${i < 2 ? "qual" : ""}">
              <td class="team">${flagImg(r.name)}<span>${esc(r.name)}</span></td>
              <td>${r.P}</td><td>${r.W}</td><td>${r.D}</td><td>${r.L}</td>
              <td>${r.GF}</td><td>${r.GA}</td><td>${r.GD > 0 ? "+" : ""}${r.GD}</td>
              <td class="pts">${r.Pts}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`).join("");
}

// ---- bracket ----
export function renderBracket(matches) {
  const order = ["Round of 32", "Round of 16", "Quarter-final", "Semi-final", "Final"];
  const labels = {
    "Round of 32": "Dieciseisavos", "Round of 16": "Octavos",
    "Quarter-final": "Cuartos", "Semi-final": "Semifinal", "Final": "Final",
  };
  const wrap = $("#bracket-wrap");
  wrap.innerHTML = order.map((round) => {
    const games = matches.filter((m) => m.round === round);
    if (!games.length) return "";
    return `<div class="bracket-col"><h4>${labels[round]}</h4>${
      games.map((m) => {
        const hs = m.score?.home, as = m.score?.away;
        const hasScore = hs != null;
        const hw = hasScore && hs > as, aw = hasScore && as > hs;
        const sc = (v) => hasScore ? `<span>${v}</span>` : "";
        return `<div class="bk">
          <div class="r ${hw ? "win" : ""}"><span class="nm">${esc(m.home.name)}</span>${sc(hs)}</div>
          <div class="r ${aw ? "win" : ""}"><span class="nm">${esc(m.away.name)}</span>${sc(as)}</div>
        </div>`;
      }).join("")
    }</div>`;
  }).join("");
}

// ---- scorers ----
export function renderScorers(list) {
  const wrap = $("#scorers-list");
  if (!list.length) { wrap.innerHTML = `<p class="empty">Aún no hay goles registrados.</p>`; return; }
  wrap.innerHTML = list.slice(0, 40).map((s, i) => `
    <div class="scorer">
      <span class="rank">${i + 1}</span>
      ${flagImg(s.country)}
      <span class="who"><div class="nm">${esc(s.name)}</div><div class="ct">${esc(s.country)}</div></span>
      <span class="goals">${s.goals}${s.penalties ? ` <small>(${s.penalties}p)</small>` : ""}</span>
    </div>`).join("");
}

// ---- venues ----
export function renderVenues() {
  const grid = $("#venues-grid");
  grid.innerHTML = Object.entries(VENUES).map(([, v]) => `
    <div class="venue">
      <div class="vn">${flagImg(v.country)}${esc(v.stadium)}</div>
      <div class="vc">${esc(v.city)}, ${esc(v.country)}</div>
    </div>`).join("");
}

// ---- stats KPIs ----
export function renderStatsKpis(stats, matches) {
  const finished = matches.filter((m) => m.status === "finished").length;
  const live = matches.filter((m) => m.status === "live").length;
  const kpis = [
    ["Partidos jugados", stats.played],
    ["Goles totales", stats.goals],
    ["Promedio de goles", stats.avg ? stats.avg.toFixed(2) : "0.00"],
    ["En vivo ahora", live],
    ["Finalizados", finished],
    ["Restantes", matches.length - finished],
  ];
  $("#stats-kpis").innerHTML = kpis.map(([l, n]) =>
    `<div class="stat"><div class="num">${n}</div><div class="label">${l}</div></div>`).join("");
}

// Small count-up animation for overview numbers.
export function animateCounts(root = document) {
  for (const el of root.querySelectorAll("[data-count]")) {
    const target = parseFloat(el.dataset.count);
    if (Number.isNaN(target) || target > 1000) continue;
    let cur = 0;
    const step = Math.max(1, Math.ceil(target / 28));
    const tick = () => {
      cur = Math.min(target, cur + step);
      el.textContent = cur;
      if (cur < target) requestAnimationFrame(tick);
    };
    tick();
  }
}
