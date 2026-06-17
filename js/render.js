// render.js — pure DOM rendering helpers. No data fetching here.

import { VENUES } from "./config.js";
import { flagUrl, kickoffLabel, kickoffDateTime } from "./api.js";

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Integer with thousands separators (e.g. 2914 -> "2,914"). Non-numerics pass through.
export const fmtInt = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString("en-US") : String(n ?? "—");
};

// Wikimedia Commons hi-res image via the stable Special:FilePath redirect.
const venuePhoto = (file) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1200`;

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
    : `<div class="meta">${esc(kickoffLabel(m) || "Por definir")}</div>`;
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
    `<div class="stat"><div class="num" data-count="${n}">${fmtInt(n)}</div><div class="label">${l}</div></div>`
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
        <div class="vc">${esc(v.city)}, ${esc(v.country)}</div>
        <div class="venue-stats">
          <div><span class="vk">Inaugurado</span><span class="vv">${v.built}</span></div>
          <div><span class="vk">Capacidad</span><span class="vv">${fmtInt(v.capacity)}</span></div>
          <div><span class="vk">Costo aprox.</span><span class="vv">${esc(v.cost)}</span></div>
        </div>
      </div>
    </article>`;
  }).join("");
}

// ---- live status legend (cadence + last-updated) ----
function relTime(ts) {
  if (!ts) return "—";
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `hace ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  return `hace ${Math.round(m / 60)} h`;
}

export function renderLiveStatus({ provider, updatedAt, intervalMin }) {
  const el = document.getElementById("live-status");
  if (!el) return;
  const src = provider ? "API-Football" : "datos del torneo (sin proveedor en vivo)";
  el.innerHTML = `
    <span class="live-status-dot ${provider ? "on" : ""}"></span>
    <span class="live-status-txt">Fuente: <b>${src}</b> · se actualiza cada ${intervalMin} min</span>
    <span class="live-status-ago">Actualizado ${relTime(updatedAt)}</span>`;
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
        <h3>No hay partidos en vivo ahora</h3>
        <p class="section-sub" style="margin:.2rem 0 0">En cuanto ruede el balón, el marcador y los goles aparecerán aquí en tiempo real.</p>
      </div>
    </div>
    ${upcoming.length ? `<h3 class="section-title">Próximos partidos</h3>
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
  const clock = m.elapsed != null ? `${m.elapsed}'` : "En vivo";

  // Optional live statistics row (only when the provider supplies them).
  let statsRow = "";
  const sh = m.stats?.home, sa = m.stats?.away;
  if (sh && sa && (sh.fouls != null || sh.shots != null)) {
    const stat = (label, hv, av) => `
      <div class="ls-row"><span class="ls-h">${hv ?? "–"}</span><span class="ls-k">${label}</span><span class="ls-a">${av ?? "–"}</span></div>`;
    statsRow = `<div class="live-stats">
      ${stat("Tiros a arco", sh.shots, sa.shots)}
      ${stat("Faltas", sh.fouls, sa.fouls)}
    </div>`;
  }

  return `
  <article class="live-card">
    <div class="live-top">
      <span class="badge live">● ${esc(clock)}</span>
      <span class="live-round">${esc(m.round)}</span>
    </div>
    <div class="live-score">
      <div class="lt home">${flagImg(m.home.name)}<span class="nm">${esc(m.home.name)}</span></div>
      <div class="lsc">${h} <span>–</span> ${a}</div>
      <div class="lt away"><span class="nm">${esc(m.away.name)}</span>${flagImg(m.away.name)}</div>
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
  return `
  <div class="match">
    <div class="side home">${flagImg(m.home.name)}<span class="nm">${esc(m.home.name)}</span></div>
    <div class="center">
      <span class="badge up">Próximo</span>
      <div class="meta">${esc(kickoffDateTime(m) || kickoffLabel(m) || "Por definir")}</div>
    </div>
    <div class="side away">${flagImg(m.away.name)}<span class="nm">${esc(m.away.name)}</span></div>
  </div>`;
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
    `<div class="stat"><div class="num">${fmtInt(n)}</div><div class="label">${l}</div></div>`).join("");
}

// ---- curated tournament aggregates (offsides, cards, VAR, …) ----
export function renderAggregates(facts) {
  const a = facts.aggregates || {};
  const items = [
    ["🚩", "Fueras de lugar", a.offsides],
    ["🚫", "Goles anulados", a.disallowedGoals],
    ["📺", "Revisiones VAR", a.varReviews],
    ["🎯", "Penales señalados", a.penaltiesAwarded],
    ["🟨", "Tarjetas amarillas", a.yellowCards],
    ["🟥", "Tarjetas rojas", a.redCards],
    ["⚠️", "Faltas cometidas", a.fouls],
    ["📐", "Tiros de esquina", a.corners],
    ["🧤", "Atajadas", a.saves],
    ["👥", "Asistencia total", a.attendance],
  ];
  const grid = document.getElementById("agg-grid");
  if (!grid) return;
  grid.innerHTML = items.map(([icon, label, val]) => `
    <div class="stat agg">
      <div class="agg-icon" aria-hidden="true">${icon}</div>
      <div class="num">${val == null ? "—" : fmtInt(val)}</div>
      <div class="label">${label}</div>
    </div>`).join("");
}

// ---- derived "bizarre" facts cards ----
export function renderFacts(facts) {
  const wrap = document.getElementById("facts-grid");
  if (!wrap) return;

  const pair = (m) => m ? `${esc(m.home.name)} vs ${esc(m.away.name)}` : "—";
  const cards = [];

  if (facts.highest)
    cards.push(fact("🔥", "Partido más goleador",
      `${facts.highest.total} goles`, `${pair(facts.highest.m)} (${facts.highest.score})`));
  if (facts.biggest)
    cards.push(fact("💥", "Mayor goleada",
      `${facts.biggest.margin} de diferencia`, `${pair(facts.biggest.m)} (${facts.biggest.score})`));
  if (facts.fastest)
    cards.push(fact("⚡", "Gol más madrugador",
      `Min. ${facts.fastest.min}'`, esc(facts.fastest.name || "—")));
  if (facts.latest)
    cards.push(fact("⏱️", "Gol más tardío",
      `Min. ${facts.latest.min}'`, esc(facts.latest.name || "—")));

  cards.push(fact("🎩", "Hat-tricks",
    String(facts.hatTricks.length),
    facts.hatTricks.length ? esc(facts.hatTricks[0].name) + (facts.hatTricks.length > 1 ? " y más" : "") : "Aún ninguno"));
  cards.push(fact("🔄", "Remontadas", String(facts.comebacks), "Perdían al descanso y ganaron"));
  cards.push(fact("🥅", "Tandas de penales", String(facts.shootouts), "Definidos desde los once pasos"));
  cards.push(fact("🧱", "Porterías en cero", String(facts.cleanSheets), "Partidos con valla invicta"));
  cards.push(fact("🥱", "Empates 0–0", String(facts.zeroZero), "Duelos sin goles"));
  cards.push(fact("🏟️", "Goleadas (3+)", String(facts.blowouts), "Partidos con diferencia de 3 o más"));
  cards.push(fact("🎯", "Goles de penal", String(facts.penaltyGoals), "Anotados desde el manchón"));
  if (facts.topTeams[0])
    cards.push(fact("👑", "Ataque más letal",
      `${facts.topTeams[0].goals} goles`, esc(facts.topTeams[0].name)));

  wrap.innerHTML = cards.join("");
}

function fact(icon, label, value, detail) {
  return `
  <div class="fact">
    <div class="fact-icon" aria-hidden="true">${icon}</div>
    <div class="fact-body">
      <div class="fact-value">${value}</div>
      <div class="fact-label">${label}</div>
      <div class="fact-detail">${detail}</div>
    </div>
  </div>`;
}

// ---- discipline & shooting efficacy ----
export function renderDiscipline(disc) {
  // KPI cards: most fouls + least efficacy (shots per goal).
  const kpiWrap = document.getElementById("disc-kpis");
  if (kpiWrap) {
    const mf = disc.mostFouls, le = disc.leastEfficacy;
    const cards = [];
    if (mf) cards.push(`
      <div class="fact">
        <div class="fact-icon">⚠️</div>
        <div class="fact-body">
          <div class="fact-value">${fmtInt(mf.fouls)} faltas</div>
          <div class="fact-label">Selección más infractora</div>
          <div class="fact-detail">${flagImg(mf.name)} ${esc(mf.name)}</div>
        </div>
      </div>`);
    if (le) cards.push(`
      <div class="fact">
        <div class="fact-icon">🎯</div>
        <div class="fact-body">
          <div class="fact-value">${le.ratio.toFixed(1)} tiros/gol</div>
          <div class="fact-label">Menor eficacia (tiros a arco ÷ goles)</div>
          <div class="fact-detail">${flagImg(le.name)} ${esc(le.name)} · ${le.shots} tiros · ${le.goals} goles</div>
        </div>
      </div>`);
    kpiWrap.innerHTML = cards.join("");
  }

  // Top-10 fouls table.
  const tbl = document.getElementById("fouls-table");
  if (tbl) {
    const rows = disc.foulsRanking.slice(0, 10);
    tbl.innerHTML = `
      <table class="rank-table">
        <thead><tr><th>#</th><th style="text-align:left">Selección</th><th>Faltas</th></tr></thead>
        <tbody>${rows.map((r, i) => `
          <tr>
            <td class="rk">${i + 1}</td>
            <td class="team">${flagImg(r.name)}<span>${esc(r.name)}</span></td>
            <td class="val">${fmtInt(r.fouls)}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;
  }
}

// ---- social feeds (X + Instagram) for the live tab ----
export function renderSocial() {
  const wrap = document.getElementById("social-wrap");
  if (!wrap || wrap.dataset.ready) return;
  wrap.dataset.ready = "1";
  wrap.innerHTML = `
    <div class="social-grid">
      <div class="card social-card">
        <h3>𝕏 · @FIFAWorldCup</h3>
        <div class="social-embed">
          <a class="twitter-timeline" data-theme="dark" data-height="520" data-chrome="noheader nofooter transparent"
             href="https://twitter.com/FIFAWorldCup?ref_src=twsrc%5Etfw">Publicaciones de @FIFAWorldCup</a>
        </div>
        <a class="social-link" href="https://x.com/FIFAWorldCup" target="_blank" rel="noopener">Abrir en X ↗</a>
      </div>
      <div class="card social-card">
        <h3>📸 · @fifaworldcup</h3>
        <div class="social-embed ig">
          <blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/fifaworldcup/"
            data-instgrm-version="14"></blockquote>
          <div class="ig-fallback">
            <p>Sigue la cobertura oficial en Instagram para fotos y reels del torneo.</p>
          </div>
        </div>
        <a class="social-link" href="https://www.instagram.com/fifaworldcup/" target="_blank" rel="noopener">Abrir en Instagram ↗</a>
      </div>
    </div>`;

  // Load widget scripts once (best-effort; links remain if they don't load).
  loadScript("https://platform.twitter.com/widgets.js", () => window.twttr?.widgets?.load(wrap));
  loadScript("https://www.instagram.com/embed.js", () => window.instgrm?.Embeds?.process());
}

function loadScript(src, onload) {
  if (document.querySelector(`script[src="${src}"]`)) { onload?.(); return; }
  const s = document.createElement("script");
  s.src = src; s.async = true; s.onload = onload;
  document.body.appendChild(s);
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
