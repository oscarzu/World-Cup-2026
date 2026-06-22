// charts.js — data-storytelling visualizations (Chart.js).
//  • Direct value labels on marks (less axis-reading).
//  • One "signal" colour + muted context (guide the eye).
//  • Minimal gridlines; a one-line takeaway under each chart.
//  • Bilingual (ES/EN) labels and takeaways.

import { tName, t, getLang } from "./i18n.js";

const charts = {};
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

function baseOpts(t2, { horizontal = false, valueLabels = true, valueColor, suffix = "", lineY = false } = {}) {
  const ticks = { color: t2.text, font: { size: 11, family: FONT }, autoSkip: false };
  const catTicks = { color: t2.textStrong, font: { size: 11, family: FONT, weight: "600" }, autoSkip: false };
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
      y: { grid: { display: lineY, color: t2.grid, drawBorder: false }, ticks: horizontal ? catTicks : (lineY ? ticks : { display: false }), beginAtZero: true },
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
  if (Array.isArray(keys) && keys.length) attachDrillAccess(id, labels, data, keys, opts.suffix || "");
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

const escH = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Keyboard/screen-reader alternative to clicking bars: a "See detail" disclosure
// listing each entity as a real button that triggers the same drill-down.
function attachDrillAccess(id, labels, data, keys, suffix = "") {
  const el = document.getElementById(id);
  const box = el && el.closest(".chart-box");
  if (!box) return;
  let acc = box.parentNode.querySelector(".drill-access");
  if (!acc) { acc = document.createElement("div"); acc.className = "drill-access"; box.insertAdjacentElement("afterend", acc); }
  const items = labels.map((l, i) =>
    `<li><button type="button" class="drill-item" data-chart="${escH(id)}" data-key="${escH(keys[i])}">${escH(l)} · <b>${fmt(data[i])}${escH(suffix)}</b></button></li>`).join("");
  acc.innerHTML =
    `<button type="button" class="drill-btn" aria-expanded="false">${t("drill.detail")} ↗</button>
     <ul class="drill-list" hidden><li class="drill-pick">${t("drill.pick")}</li>${items}</ul>`;
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
    const md = lastStats.byMatchday;
    upsert("chart-overview", "line", md.map(([k]) => `J${k}`), md.map(([, v]) => v), t("u.goals"),
      { color: tc.accent, lineY: true, valueLabels: true, valueColor: tc.text });
    if (md.length) {
      const peak = md.reduce((a, b) => (b[1] > a[1] ? b : a));
      setSub("sub-overview", sub(`Pico de ${peak[1]} goles en la jornada ${peak[0]}.`,
        `Peak of ${peak[1]} goals on matchday ${peak[0]}.`));
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

    upsert("chart-moments", "bar",
      [t("f.comebacks"), t("f.shootouts"), t("f.blowouts"), t("f.zerozero"), t("f.hattricks")],
      [lastFacts.comebacks, lastFacts.shootouts, lastFacts.blowouts, lastFacts.zeroZero, lastFacts.hatTricks.length],
      t("u.matches"), { colors: [tc.accent, tc.live, tc.gold, tc.context, tc.accent2] });
    setSub("sub-moments", sub(`${lastFacts.comebacks} remontadas y ${lastFacts.shootouts} tandas de penales hasta ahora.`,
      `${lastFacts.comebacks} comebacks and ${lastFacts.shootouts} shootouts so far.`));
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
        { horizontal: true, emphasis: true, leadFirst: true, color: tc.live });
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
    effSeries("chart-eff-jornada", lastEffHist, "perJornada", tc);
    effSeries("chart-eff-cumulative", lastEffHist, "accumulated", tc);
    const note = sub("Etiquetas sobre cada punto: selección y su % de conversión.",
      "Labels on each point: team and its conversion %.");
    setSub("sub-eff-jornada", note); setSub("sub-eff-cumulative", note);
  }
}

// Two-line efficacy chart (best vs worst) with the team labelled at every point.
function effSeries(canvasId, history, kind, tc) {
  if (typeof Chart === "undefined") return;
  const el = document.getElementById(canvasId);
  if (!el) return;
  ensurePlugin();
  if (charts[canvasId]) { charts[canvasId].destroy(); delete charts[canvasId]; }

  const mdPre = getLang() === "en" ? "MD" : "J";
  const labels = history.map((h) => `${mdPre}${h.matchday}`);
  const bestTeams = history.map((h) => tName(h[kind].best.team));
  const worstTeams = history.map((h) => tName(h[kind].worst.team));
  const bestData = history.map((h) => h[kind].best.pct);
  const worstData = history.map((h) => h[kind].worst.pct);

  const pointLabels = {
    id: "pointLabels",
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx; ctx.save(); ctx.font = `700 10px ${FONT}`; ctx.textAlign = "center";
      chart.data.datasets.forEach((ds, di) => {
        const meta = chart.getDatasetMeta(di);
        const teams = di === 0 ? bestTeams : worstTeams;
        const above = di === 0;
        ctx.fillStyle = ds.borderColor;
        ctx.textBaseline = above ? "bottom" : "top";
        meta.data.forEach((pt, i) => {
          ctx.fillText(`${teams[i]} ${ds.data[i]}%`, pt.x, pt.y + (above ? -9 : 9));
        });
      });
      ctx.restore();
    },
  };

  charts[canvasId] = new Chart(el, {
    type: "line",
    data: { labels, datasets: [
      { label: t("eff.seriesBest"), data: bestData, borderColor: tc.accent, backgroundColor: tc.accent + "22",
        tension: 0.35, pointRadius: 4, pointBackgroundColor: tc.accent, borderWidth: 2.5, fill: false },
      { label: t("eff.seriesWorst"), data: worstData, borderColor: tc.live, backgroundColor: tc.live + "22",
        tension: 0.35, pointRadius: 4, pointBackgroundColor: tc.live, borderWidth: 2.5, fill: false },
    ] },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 22, bottom: 22, left: 8, right: 8 } },
      animation: { duration: 700, easing: "easeOutQuart" },
      plugins: {
        valueLabels: { display: false },
        legend: { display: true, position: "top", align: "end",
          labels: { color: tc.text, font: { family: FONT, size: 11 }, boxWidth: 10, boxHeight: 10, usePointStyle: true } },
        tooltip: {
          backgroundColor: tc.tooltipBg, titleColor: tc.textStrong, bodyColor: tc.textStrong,
          borderColor: tc.border, borderWidth: 1, padding: 10, cornerRadius: 10,
          callbacks: { label(ctx) {
            const team = ctx.datasetIndex === 0 ? bestTeams[ctx.dataIndex] : worstTeams[ctx.dataIndex];
            return `${ctx.dataset.label}: ${team} (${ctx.formattedValue}%)`;
          } },
        },
      },
      scales: {
        x: { grid: { display: false, drawBorder: false }, ticks: { color: tc.text, font: { size: 11, family: FONT } } },
        y: { min: 0, max: 100, grid: { display: true, color: tc.grid, drawBorder: false },
          ticks: { color: tc.text, font: { size: 11, family: FONT }, callback: (v) => v + "%" } },
      },
    },
    plugins: [pointLabels],
  });
  el.setAttribute("role", "img");
  el.setAttribute("aria-label",
    `${t("a11y.chart")}: ${t("eff.seriesBest")} ${bestTeams.map((tm, i) => `${tm} ${bestData[i]}%`).join(", ")}. ` +
    `${t("eff.seriesWorst")} ${worstTeams.map((tm, i) => `${tm} ${worstData[i]}%`).join(", ")}.`);
}

// Re-draw with current theme colours / language.
export function rethemeCharts() { renderCharts(); }
