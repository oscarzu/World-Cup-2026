// charts.js — data-storytelling visualizations (Chart.js).
// Principles applied:
//  • Direct value labels on marks → less axis-reading (Tufte's data-ink ratio).
//  • One "signal" colour + muted context bars → guide the eye (Knaflic).
//  • Minimal gridlines / no redundant axes (declutter).
//  • A one-line takeaway under each chart (title = what, subtitle = so-what).

const charts = {};
const FONT = (getComputedStyle(document.documentElement).getPropertyValue("--font") || "system-ui").trim()
  || "system-ui, sans-serif";
const fmt = (n) => (typeof n === "number" ? n.toLocaleString("en-US") : n);

function theme() {
  const cs = getComputedStyle(document.documentElement);
  const v = (k, d) => (cs.getPropertyValue(k).trim() || d);
  return {
    accent: v("--accent", "#2fd968"),
    accent2: v("--accent-2", "#14b8a6"),
    gold: v("--gold", "#ffd23f"),
    live: v("--live", "#ff453a"),
    context: v("--chart-context", "rgba(150,160,175,.35)"),
    grid: v("--chart-grid", "rgba(150,160,175,.16)"),
    text: v("--muted", "#8b94a3"),
    textStrong: v("--text", "#eef1f5"),
    tooltipBg: v("--surface-solid", "#14161c"),
    border: v("--border-strong", "rgba(255,255,255,.16)"),
  };
}

// Plugin: render each value at the end of its bar / above its point.
const ValueLabels = {
  id: "valueLabels",
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts || opts.display === false) return;
    const ds = chart.data.datasets[0];
    const meta = chart.getDatasetMeta(0);
    const horizontal = chart.options.indexAxis === "y";
    const ctx = chart.ctx;
    ctx.save();
    ctx.font = `700 11px ${FONT}`;
    ctx.fillStyle = opts.color || "#999";
    meta.data.forEach((el, i) => {
      const val = ds.data[i];
      if (val == null) return;
      if (horizontal) {
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(fmt(val), el.x + 6, el.y);
      } else {
        ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.fillText(fmt(val), el.x, el.y - 5);
      }
    });
    ctx.restore();
  },
};
let pluginReady = false;
function ensurePlugin() {
  if (pluginReady || typeof Chart === "undefined") return;
  Chart.register(ValueLabels);
  pluginReady = true;
}

// Build per-bar colours: the leader in `signal`, everyone else muted context.
function emphasize(data, signal, context) {
  const vals = data.filter((v) => v != null);
  if (!vals.length) return data.map(() => signal);
  const max = Math.max(...vals);
  return data.map((v) => (v === max ? signal : context));
}

function baseOpts(t, { horizontal = false, valueLabels = true, valueColor, lineY = false } = {}) {
  const ticks = { color: t.text, font: { size: 11, family: FONT } };
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? "y" : "x",
    layout: { padding: horizontal ? { right: 40, left: 2 } : { top: 20 } },
    animation: { duration: 750, easing: "easeOutQuart" },
    plugins: {
      legend: { display: false },
      valueLabels: { display: valueLabels, color: valueColor || t.textStrong },
      tooltip: {
        backgroundColor: t.tooltipBg, titleColor: t.textStrong, bodyColor: t.textStrong,
        borderColor: t.border, borderWidth: 1, padding: 10, cornerRadius: 10, displayColors: false,
        titleFont: { family: FONT, weight: "700" }, bodyFont: { family: FONT },
      },
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        ticks: horizontal ? { display: false } : ticks,
        beginAtZero: true,
      },
      y: {
        grid: { display: lineY, color: t.grid, drawBorder: false },
        ticks: horizontal ? ticks : (lineY ? ticks : { display: false }),
        beginAtZero: true,
      },
    },
  };
}

function upsert(id, type, labels, data, label, opts = {}) {
  if (typeof Chart === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  ensurePlugin();
  const t = theme();
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }

  const isLine = type === "line";
  const bg = Array.isArray(opts.colors) ? opts.colors
    : opts.emphasis ? emphasize(data, opts.color || t.accent, t.context)
    : isLine ? (opts.color || t.accent) + "22"
    : (opts.color || t.accent);

  charts[id] = new Chart(el, {
    type,
    data: {
      labels,
      datasets: [{
        label, data,
        backgroundColor: bg,
        borderColor: opts.color || t.accent,
        borderRadius: isLine ? 0 : 7,
        borderWidth: isLine ? 2.5 : 0,
        maxBarThickness: 30,
        tension: 0.4,
        pointRadius: isLine ? 3.5 : 0,
        pointHoverRadius: 5,
        pointBackgroundColor: opts.color || t.accent,
        fill: isLine ? { target: "origin" } : false,
      }],
    },
    options: baseOpts(t, opts),
  });
}

function setSub(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text || "";
}
const topOf = (arr, key) => (arr && arr.length ? arr[0] : null);

let lastStats = null, lastFacts = null, lastDisc = null;

export function renderCharts(stats, facts, disc) {
  if (stats) lastStats = stats;
  if (facts) lastFacts = facts;
  if (disc) lastDisc = disc;
  const t = theme();

  if (lastStats) {
    const md = lastStats.byMatchday;
    upsert("chart-overview", "line",
      md.map(([k]) => `J${k}`), md.map(([, v]) => v), "Goles",
      { color: t.accent, lineY: true, valueLabels: true, valueColor: t.text });
    if (md.length) {
      const peak = md.reduce((a, b) => (b[1] > a[1] ? b : a));
      setSub("sub-overview", `Pico de ${peak[1]} goles en la jornada ${peak[0]}.`);
    }

    upsert("chart-groups", "bar",
      lastStats.byGroup.map(([k]) => k.replace("Group ", "")),
      lastStats.byGroup.map(([, v]) => v), "Goles", { emphasis: true, color: t.accent });
    if (lastStats.byGroup.length) {
      const g = lastStats.byGroup.reduce((a, b) => (b[1] > a[1] ? b : a));
      setSub("sub-groups", `El grupo ${g[0].replace("Group ", "")} es el más goleador, con ${g[1]} goles.`);
    }
  }

  if (lastFacts) {
    const tt = lastFacts.topTeams || [];
    upsert("chart-teams", "bar",
      tt.map((x) => x.name), tt.map((x) => x.goals), "Goles",
      { horizontal: true, emphasis: true, color: t.gold });
    const lead = topOf(tt);
    if (lead) setSub("sub-teams", `${lead.name} encabeza el ataque con ${lead.goals} goles.`);

    upsert("chart-moments", "bar",
      ["Remontadas", "Penales", "Goleadas 3+", "0–0", "Hat-tricks"],
      [lastFacts.comebacks, lastFacts.shootouts, lastFacts.blowouts,
        lastFacts.zeroZero, lastFacts.hatTricks.length], "Partidos",
      { colors: [t.accent, t.live, t.gold, t.context, t.accent2] });
    setSub("sub-moments", `${lastFacts.comebacks} remontadas y ${lastFacts.shootouts} tandas de penales hasta ahora.`);
  }

  if (lastDisc) {
    const fr = (lastDisc.foulsRanking || []).slice(0, 10);
    upsert("chart-fouls", "bar",
      fr.map((x) => x.name), fr.map((x) => x.fouls), "Faltas",
      { horizontal: true, emphasis: true, color: t.live });
    if (fr.length) setSub("sub-fouls", `${fr[0].name} es la más infractora, con ${fmt(fr[0].fouls)} faltas.`);

    const yc = lastDisc.yellow || [];
    upsert("chart-cards", "bar",
      yc.map((x) => x.name), yc.map((x) => x.cards), "Amarillas",
      { horizontal: true, emphasis: true, color: t.gold });
    if (yc.length) setSub("sub-cards", `${yc[0].name} lidera con ${yc[0].cards} amarillas.`);
  }
}

// Re-draw with current theme colours (after a dark/light toggle).
export function rethemeCharts() { renderCharts(); }
