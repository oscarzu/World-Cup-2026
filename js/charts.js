// charts.js — data-storytelling visualizations (Chart.js).
//  • Direct value labels on marks (less axis-reading).
//  • One "signal" colour + muted context (guide the eye).
//  • Minimal gridlines; a one-line takeaway under each chart.
//  • Bilingual (ES/EN) labels and takeaways.

import { tName, t, getLang } from "./i18n.js";

const charts = {};
// Short knockout-round labels (i18n keys) for the goals-by-phase chart.
const KO_SHORT = {
  "Round of 32": "br.r32", "Round of 16": "br.r16", "Quarter-final": "br.qf",
  "Semi-final": "br.sf", "Match for third place": "br.third", "Final": "br.final",
};
const FONT = (getComputedStyle(document.documentElement).getPropertyValue("--font") || "system-ui").trim()
  || "system-ui, sans-serif";
const fmt = (n) => (typeof n === "number" ? n.toLocaleString("en-US") : n);
const round1 = (n) => Math.round(n * 10) / 10;
const sub = (es, en) => (getLang() === "en" ? en : es);

function theme() {
  const cs = getComputedStyle(document.documentElement);
  const v = (k, d) => (cs.getPropertyValue(k).trim() || d);
  return {
    accent: v("--accent", "#2fd968"), accent2: v("--accent-2", "#14b8a6"),
    gold: v("--gold", "#ffd23f"), live: v("--live", "#ff453a"),
    context: v("--chart-context", "rgba(150,160,175,.35)"),
    grid: v("--chart-grid", "rgba(150,160,175,.16)"),
    text: v("--muted", "#8b94a3"), textStrong: v("--text", "#eef1f5"),
    tooltipBg: v("--surface-solid", "#14161c"), border: v("--border-strong", "rgba(255,255,255,.16)"),
  };
}

// Plugin: render each value at the end of its bar / above its point (+ optional suffix).
const ValueLabels = {
  id: "valueLabels",
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts || opts.display === false) return;
    const ds = chart.data.datasets[0];
    const meta = chart.getDatasetMeta(0);
    const horizontal = chart.options.indexAxis === "y";
    const ctx = chart.ctx; const sfx = opts.suffix || "";
    ctx.save();
    ctx.font = `700 11px ${FONT}`;
    ctx.fillStyle = opts.color || "#999";
    meta.data.forEach((el, i) => {
      const val = ds.data[i];
      if (val == null) return;
      if (horizontal) { ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(fmt(val) + sfx, el.x + 6, el.y); }
      else { ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(fmt(val) + sfx, el.x, el.y - 5); }
    });
    ctx.restore();
  },
};
let pluginReady = false;
function ensurePlugin() {
  if (pluginReady || typeof Chart === "undefined") return;
  Chart.register(ValueLabels); pluginReady = true;
}

function emphasize(data, signal, context, leadFirst = false) {
  const vals = data.filter((v) => v != null);
  if (!vals.length) return data.map(() => signal);
  if (leadFirst) return data.map((_, i) => (i === 0 ? signal : context));
  const max = Math.max(...vals);
  return data.map((v) => (v === max ? signal : context));
}

function baseOpts(t2, { horizontal = false, valueLabels = true, valueColor, suffix = "", lineY = false, logY = false } = {}) {
  const ticks = { color: t2.text, font: { size: 11, family: FONT }, autoSkip: false };
  const catTicks = { color: t2.textStrong, font: { size: 11, family: FONT, weight: "600" }, autoSkip: false };
  // Logarithmic y compresses huge absolute gaps (e.g. 215 group goals vs a few
  // per knockout round) so the smaller phases stay readable. min<1 keeps a
  // value of 1 from collapsing onto the axis.
  const yAxis = logY
    ? { type: "logarithmic", min: 0.5, grid: { display: true, color: t2.grid, drawBorder: false },
        ticks: { color: t2.text, font: { size: 11, family: FONT },
          callback: (v) => ([1, 3, 10, 30, 100, 300].includes(v) ? v : "") } }
    : { grid: { display: lineY, color: t2.grid, drawBorder: false },
        ticks: horizontal ? catTicks : (lineY ? ticks : { display: false }), beginAtZero: true };
  return {
    responsive: true, maintainAspectRatio: false,
    indexAxis: horizontal ? "y" : "x",
    layout: { padding: horizontal ? { right: 44, left: 2 } : { top: 20 } },
    animation: { duration: 750, easing: "easeOutQuart" },
    plugins: {
      legend: { display: false },
      valueLabels: { display: valueLabels, color: valueColor || t2.textStrong, suffix },
      tooltip: {
        backgroundColor: t2.tooltipBg, titleColor: t2.textStrong, bodyColor: t2.textStrong,
        borderColor: t2.border, borderWidth: 1, padding: 10, cornerRadius: 10, displayColors: false,
        titleFont: { family: FONT, weight: "700" }, bodyFont: { family: FONT },
      },
    },
    scales: {
      x: { grid: { display: false, drawBorder: false }, ticks: horizontal ? { display: false } : catTicks, beginAtZero: true },
      y: yAxis,
    },
  };
}

function upsert(id, type, labels, data, label, opts = {}) {
  if (typeof Chart === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  ensurePlugin();
  const t2 = theme();
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  const isLine = type === "line";
  const bg = Array.isArray(opts.colors) ? opts.colors
    : opts.emphasis ? emphasize(data, opts.color || t2.accent, t2.context, opts.leadFirst)
    : isLine ? (opts.color || t2.accent) + "22" : (opts.color || t2.accent);
  const options = baseOpts(t2, opts);
  // Drill-down: tap a bar → emit an event the app turns into a detail modal.
  const keys = opts.drillKeys;
  if (Array.isArray(keys) && keys.length) {
    options.onClick = (_e, els) => {
      if (!els || !els.length) return;
      const i = els[0].index;
      window.dispatchEvent(new CustomEvent("wc:drill", { detail: { chart: id, key: keys[i], index: i } }));
    };
    options.onHover = (e, els) => { e.native.target.style.cursor = els.length ? "pointer" : "default"; };
  }
  charts[id] = new Chart(el, {
    type,
    data: { labels, datasets: [{
      label, data, backgroundColor: bg, borderColor: opts.color || t2.accent,
      borderRadius: isLine ? 0 : 7, borderWidth: isLine ? 2.5 : 0, maxBarThickness: 30,
      tension: 0.4, pointRadius: isLine ? 3.5 : 0, pointHoverRadius: 5,
      pointBackgroundColor: opts.color || t2.accent, fill: isLine ? { target: "origin" } : false,
    }] },
    options,
  });
  setChartA11y(id, label, labels, data, opts.suffix || "");
}

function setSub(id, text) { const el = document.getElementById(id); if (el) el.textContent = text || ""; }

// Accessibility: describe the canvas as an image with a short data summary.
function setChartA11y(id, label, labels, data, suffix = "") {
  const el = document.getElementById(id);
  if (!el) return;
  const top = labels.map((l, i) => `${l} ${fmt(data[i])}${suffix}`).slice(0, 4).join(", ");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", `${t("a11y.chart")}: ${label}. ${top}`);
}

const topOf = (arr) => (arr && arr.length ? arr[0] : null);

let lastStats = null, lastFacts = null, lastDisc = null, lastEffHist = null;

export function renderCharts(stats, facts, disc, effHist) {
  if (stats) lastStats = stats;
  if (facts) lastFacts = facts;
  if (disc) lastDisc = disc;
  if (effHist) lastEffHist = effHist;
  const tc = theme();

  if (lastStats) {
    // Goals by phase: whole group stage as one bar, then each knockout round
    // (R32 → Final) summarized. Group = accent, knockouts = gold.
    const ph = lastStats.byPhase || [];
    const phaseLabel = (e) => (e.stage === "group" ? t("ph.group") : (KO_SHORT[e.key] ? t(KO_SHORT[e.key]) : e.key));
    const phColors = ph.map((e) => (e.stage === "group" ? tc.accent : tc.gold));
    upsert("chart-overview", "bar", ph.map(phaseLabel), ph.map((e) => e.goals), t("u.goals"),
      { colors: phColors, valueLabels: true, valueColor: tc.textStrong, logY: true, drillKeys: ph.map((e) => e.key) });
    if (ph.length) {
      const groupG = ph.filter((e) => e.stage === "group").reduce((s, e) => s + e.goals, 0);
      const koG = ph.filter((e) => e.stage === "knockout").reduce((s, e) => s + e.goals, 0);
      setSub("sub-overview", koG
        ? sub(`Fase de grupos: ${groupG} goles · eliminatorias: ${koG} goles.`,
              `Group stage: ${groupG} goals · knockouts: ${koG} goals.`)
        : sub(`Fase de grupos: ${groupG} goles. Las eliminatorias se sumarán por ronda.`,
              `Group stage: ${groupG} goals. Knockouts will be summed by round.`));
    }
    upsert("chart-groups", "bar",
      lastStats.byGroup.map(([k]) => k.replace("Group ", "")),
      lastStats.byGroup.map(([, v]) => v), t("u.goals"),
      { emphasis: true, color: tc.accent, drillKeys: lastStats.byGroup.map(([k]) => k) });
    if (lastStats.byGroup.length) {
      const g = lastStats.byGroup.reduce((a, b) => (b[1] > a[1] ? b : a));
      setSub("sub-groups", sub(`El grupo ${g[0].replace("Group ", "")} es el más goleador, con ${g[1]} goles.`,
        `Group ${g[0].replace("Group ", "")} is the highest-scoring, with ${g[1]} goals.`));
    }
  }

  if (lastFacts) {
    const tt = lastFacts.topTeams || [];
    upsert("chart-teams", "bar", tt.map((x) => tName(x.name)), tt.map((x) => x.goals), t("u.goals"),
      { horizontal: true, emphasis: true, color: tc.gold, drillKeys: tt.map((x) => x.name) });
    if (tt.length) {
      const maxG = tt[0].goals;
      const lead = tt.filter((x) => x.goals === maxG);
      const names = lead.map((x) => tName(x.name)).join(getLang() === "en" ? " & " : " y ");
      const many = lead.length > 1;
      setSub("sub-teams", sub(`${names} encabeza${many ? "n" : ""} el ataque con ${maxG} goles.`,
        `${names} lead${many ? "" : "s"} the attack with ${maxG} goals.`));
    }

    // Moments: sorted high → low, with zero-value categories hidden.
    const moments = [
      { label: t("f.comebacks"), v: lastFacts.comebacks, key: "comebacks", c: tc.accent },
      { label: t("f.shootouts"), v: lastFacts.shootouts, key: "shootouts", c: tc.live },
      { label: t("f.blowouts"), v: lastFacts.blowouts, key: "blowouts", c: tc.gold },
      { label: t("f.zerozero"), v: lastFacts.zeroZero, key: "zeroZero", c: tc.context },
      { label: t("f.hattricks"), v: lastFacts.hatTricks.length, key: "hattricks", c: tc.accent2 },
    ].filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
    if (moments.length) {
      upsert("chart-moments", "bar", moments.map((x) => x.label), moments.map((x) => x.v),
        t("u.matches"), { colors: moments.map((x) => x.c), drillKeys: moments.map((x) => x.key) });
      const top = moments[0];
      setSub("sub-moments", sub(`${top.v} ${top.label.toLowerCase()} encabeza${top.v === 1 ? "" : "n"} los momentos del torneo.`,
        `${top.v} ${top.label.toLowerCase()} lead${top.v === 1 ? "s" : ""} the tournament's moments.`));
    }
  }

  if (lastDisc) {
    // Fouls per match (normalised).
    const fr = (lastDisc.foulsRanking || []).slice(0, 10);
    upsert("chart-fouls", "bar", fr.map((x) => tName(x.name)), fr.map((x) => round1(x.perMatch)), t("u.fouls"),
      { horizontal: true, emphasis: true, color: tc.live, drillKeys: fr.map((x) => x.name) });
    if (fr.length) setSub("sub-fouls", sub(`${tName(fr[0].name)} es la más infractora: ${round1(fr[0].perMatch)} faltas por partido.`,
      `${tName(fr[0].name)} fouls the most: ${round1(fr[0].perMatch)} per match.`));

    const yc = lastDisc.yellow || [];
    upsert("chart-cards", "bar", yc.map((x) => x.name), yc.map((x) => x.cards), t("u.cards"),
      { horizontal: true, emphasis: true, color: tc.gold });
    if (yc.length) setSub("sub-cards", sub(`${yc[0].name} lidera con ${yc[0].cards} amarillas.`,
      `${yc[0].name} leads with ${yc[0].cards} yellow cards.`));

    // Red cards by team.
    const rb = (lastDisc.redByTeam || []).slice(0, 8);
    if (rb.length) {
      upsert("chart-red", "bar", rb.map((x) => tName(x.name)), rb.map((x) => x.red), t("a.red"),
        { horizontal: true, emphasis: true, leadFirst: true, color: tc.live, drillKeys: rb.map((x) => x.name) });
      setSub("sub-red", sub(`${rb.length} selecciones con expulsión · ${lastDisc.redTotal} rojas en total.`,
        `${rb.length} teams sent off · ${lastDisc.redTotal} red cards in total.`));
    }

    // Efficacy = conversion % (goals ÷ shots on target). Higher = better.
    const eff = lastDisc.efficacy || [];          // sorted best → worst (pct desc)
    const best = eff.slice(0, 10);
    const worst = eff.slice(-10).reverse();        // lowest pct first
    if (best.length) {
      upsert("chart-eff-best", "bar", best.map((x) => tName(x.name)), best.map((x) => Math.round(x.pct)), "%",
        { horizontal: true, emphasis: true, leadFirst: true, color: tc.accent, suffix: "%", drillKeys: best.map((x) => x.name) });
      setSub("sub-eff-best", sub(`${tName(best[0].name)} es la más eficaz: ${Math.round(best[0].pct)}% de conversión.`,
        `${tName(best[0].name)} is the most efficient: ${Math.round(best[0].pct)}% conversion.`));
    }
    if (worst.length) {
      upsert("chart-eff-worst", "bar", worst.map((x) => tName(x.name)), worst.map((x) => Math.round(x.pct)), "%",
        { horizontal: true, emphasis: true, leadFirst: true, color: tc.live, suffix: "%", drillKeys: worst.map((x) => x.name) });
      setSub("sub-eff-worst", sub(`${tName(worst[0].name)} es la menos eficaz: ${Math.round(worst[0].pct)}% de conversión.`,
        `${tName(worst[0].name)} is the least efficient: ${Math.round(worst[0].pct)}% conversion.`));
    }
  }

  if (lastEffHist && lastEffHist.length) {
    // New shape uses perPhase; fall back to the legacy perJornada key.
    const perKey = lastEffHist[0] && lastEffHist[0].perPhase ? "perPhase" : "perJornada";
    effDumbbell("chart-eff-jornada", lastEffHist, perKey, tc);
    // The cumulative view is identical to per-phase until a 2nd phase exists, so
    // hide its card while there's only the group stage (avoids two twin charts).
    const cumCard = document.getElementById("chart-eff-cumulative")?.closest(".card.viz");
    if (cumCard) cumCard.style.display = lastEffHist.length < 2 ? "none" : "";
    if (lastEffHist.length >= 2) effDumbbell("chart-eff-cumulative", lastEffHist, "accumulated", tc);
    const note = sub("Cada fila es una fase: la selección más eficaz (verde) y la menos eficaz (rojo), unidas por su rango de conversión.",
      "Each row is a phase: most efficient team (green) and least efficient (red), joined by their conversion range.");
    setSub("sub-eff-jornada", note); setSub("sub-eff-cumulative", note);
  }
}

// Phase label for the efficacy history x-axis (group → R32 … Final).
function phaseAxisLabel(h) {
  if (h.phase === "group") return t("ph.group");
  if (h.phase && KO_SHORT[h.phase]) return t(KO_SHORT[h.phase]);
  if (h.matchday != null) return `${getLang() === "en" ? "MD" : "J"}${h.matchday}`; // legacy
  return h.phase || "";
}

// Dumbbell (connected-dot) chart — the standard at Opta / The Athletic for
// "best vs worst per category". Each phase is a horizontal row: a soft track
// runs from the least-efficient team (red dot) to the most-efficient (green
// dot), each end labelled with team + %. Reads cleanly with one row and scales
// to many — no sparse points, no label pile-ups.
function effDumbbell(canvasId, history, kind, tc) {
  if (typeof Chart === "undefined") return;
  const el = document.getElementById(canvasId);
  if (!el) return;
  ensurePlugin();
  if (charts[canvasId]) { charts[canvasId].destroy(); delete charts[canvasId]; }

  const labels = history.map(phaseAxisLabel);
  const best = history.map((h) => ({ team: tName(h[kind].best.team), pct: h[kind].best.pct }));
  const worst = history.map((h) => ({ team: tName(h[kind].worst.team), pct: h[kind].worst.pct }));
  // Floating bars [worst, best] become the connecting track.
  const ranges = history.map((h) => [h[kind].worst.pct, h[kind].best.pct]);

  const dumbbell = {
    id: "dumbbell",
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      const xs = chart.scales.x;
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      meta.data.forEach((bar, i) => {
        const y = bar.y;
        const xW = xs.getPixelForValue(worst[i].pct);
        const xB = xs.getPixelForValue(best[i].pct);
        const dot = (x, color) => {
          ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2);
          ctx.fillStyle = color; ctx.fill();
          ctx.lineWidth = 2.5; ctx.strokeStyle = tc.tooltipBg; ctx.stroke();
        };
        dot(xW, tc.live); dot(xB, tc.accent);
        ctx.font = `700 11px ${FONT}`;
        // best (green) label — above the green dot, flipped near the right edge.
        ctx.fillStyle = tc.accent; ctx.textBaseline = "bottom";
        const bRight = xB > xs.right - 90;
        ctx.textAlign = bRight ? "right" : "left";
        ctx.fillText(`${best[i].team} ${best[i].pct}%`, bRight ? xB - 10 : xB + 10, y - 9);
        // worst (red) label — below the red dot, flipped near the left edge.
        ctx.fillStyle = tc.live; ctx.textBaseline = "top";
        const wLeft = xW < xs.left + 90;
        ctx.textAlign = wLeft ? "left" : "right";
        ctx.fillText(`${worst[i].team} ${worst[i].pct}%`, wLeft ? xW + 10 : xW - 10, y + 11);
      });
      ctx.restore();
    },
  };

  charts[canvasId] = new Chart(el, {
    type: "bar",
    data: { labels, datasets: [{
      data: ranges, backgroundColor: tc.context, borderRadius: 999,
      barThickness: 5, borderSkipped: false,
    }] },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 26, bottom: 26, left: 6, right: 10 } },
      animation: { duration: 700, easing: "easeOutQuart" },
      plugins: {
        valueLabels: { display: false },
        legend: {
          display: true, position: "top", align: "end",
          labels: {
            color: tc.text, font: { family: FONT, size: 11 }, usePointStyle: true, boxWidth: 8,
            generateLabels: () => [
              { text: t("eff.seriesBest"), fillStyle: tc.accent, strokeStyle: tc.accent, pointStyle: "circle" },
              { text: t("eff.seriesWorst"), fillStyle: tc.live, strokeStyle: tc.live, pointStyle: "circle" },
            ],
          },
          onClick: () => {},
        },
        tooltip: {
          backgroundColor: tc.tooltipBg, titleColor: tc.textStrong, bodyColor: tc.textStrong,
          borderColor: tc.border, borderWidth: 1, padding: 10, cornerRadius: 10, displayColors: false,
          callbacks: {
            title: (items) => labels[items[0].dataIndex],
            label: (ctx) => [
              `${t("eff.seriesBest")}: ${best[ctx.dataIndex].team} ${best[ctx.dataIndex].pct}%`,
              `${t("eff.seriesWorst")}: ${worst[ctx.dataIndex].team} ${worst[ctx.dataIndex].pct}%`,
            ],
          },
        },
      },
      scales: {
        x: { min: 0, max: 100, grid: { display: true, color: tc.grid, drawBorder: false },
          ticks: { color: tc.text, font: { size: 11, family: FONT }, callback: (v) => v + "%", stepSize: 25 } },
        y: { grid: { display: false, drawBorder: false },
          ticks: { color: tc.textStrong, font: { size: 12, family: FONT, weight: "600" } } },
      },
    },
    plugins: [dumbbell],
  });
  el.setAttribute("role", "img");
  el.setAttribute("aria-label",
    `${t("a11y.chart")}: ${labels.map((l, i) => `${l} — ${t("eff.seriesBest")} ${best[i].team} ${best[i].pct}%, ${t("eff.seriesWorst")} ${worst[i].team} ${worst[i].pct}%`).join(". ")}.`);
}

// Goals-by-matchday "zoom" chart for the group-stage drill-down (rendered into
// a modal canvas). Falls back gracefully if Chart.js isn't ready.
export function drawGoalsByMatchday(canvasId, byMatchday) {
  const tc = theme();
  const md = byMatchday || [];
  upsert(canvasId, "line", md.map(([k]) => `J${k}`), md.map(([, v]) => v), t("u.goals"),
    { color: tc.accent, lineY: true, valueLabels: true, valueColor: tc.text });
}

// Re-draw with current theme colours / language.
export function rethemeCharts() { renderCharts(); }
