// charts.js — Chart.js visualizations. Charts re-theme on dark/light toggle.
// Sizing note: every canvas lives inside a fixed-height `.chart-box`, so with
// maintainAspectRatio:false the chart fills that box instead of growing forever.

const charts = {};

function theme() {
  const cs = getComputedStyle(document.documentElement);
  return {
    accent: cs.getPropertyValue("--accent").trim() || "#2fd968",
    accent2: cs.getPropertyValue("--accent-2").trim() || "#19b8a8",
    gold: cs.getPropertyValue("--gold").trim() || "#ffd23f",
    live: cs.getPropertyValue("--live").trim() || "#ff4d5e",
    grid: cs.getPropertyValue("--border").trim() || "#262b34",
    text: cs.getPropertyValue("--muted").trim() || "#8b94a3",
  };
}

function baseOpts(t, { horizontal = false } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? "y" : "x",
    animation: { duration: 600 },
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: t.grid, drawBorder: false }, ticks: { color: t.text, font: { size: 10 } }, beginAtZero: true },
      y: { grid: { color: t.grid, drawBorder: false }, ticks: { color: t.text, font: { size: 10 } }, beginAtZero: true },
    },
  };
}

function destroy(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function upsert(id, type, labels, data, label, opts = {}) {
  if (typeof Chart === "undefined") return; // CDN not ready yet
  const el = document.getElementById(id);
  if (!el) return;
  const t = theme();
  destroy(id);
  const color = opts.color || t.accent;
  charts[id] = new Chart(el, {
    type,
    data: {
      labels,
      datasets: [{
        label, data,
        backgroundColor: Array.isArray(opts.colors) ? opts.colors : color,
        borderColor: color,
        borderRadius: 8,
        borderWidth: type === "line" ? 2 : 0,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: color,
        fill: type === "line" ? { target: "origin", above: t.accent + "22" } : false,
      }],
    },
    options: baseOpts(t, opts),
  });
}

let lastStats = null, lastFacts = null, lastDisc = null;

export function renderCharts(stats, facts, disc) {
  if (stats) lastStats = stats;
  if (facts) lastFacts = facts;
  if (disc) lastDisc = disc;
  const t = theme();

  if (lastStats) {
    const md = lastStats.byMatchday;
    upsert("chart-overview", "line",
      md.map(([k]) => `J${k}`), md.map(([, v]) => v), "Goles");
    upsert("chart-groups", "bar",
      lastStats.byGroup.map(([k]) => k.replace("Group ", "")),
      lastStats.byGroup.map(([, v]) => v), "Goles");
  }

  if (lastFacts) {
    // Top scoring nations — horizontal bar reads cleanly Apple-TV style.
    const tt = lastFacts.topTeams || [];
    upsert("chart-teams", "bar",
      tt.map((x) => x.name), tt.map((x) => x.goals), "Goles",
      { horizontal: true, color: t.gold });

    // Memorable "moments" of the tournament.
    upsert("chart-moments", "bar",
      ["Remontadas", "Penales", "Goleadas 3+", "0–0", "Hat-tricks"],
      [lastFacts.comebacks, lastFacts.shootouts, lastFacts.blowouts,
        lastFacts.zeroZero, lastFacts.hatTricks.length],
      "Partidos",
      { colors: [t.accent, t.live, t.gold, t.text, t.accent2] });
  }

  if (lastDisc) {
    // Most-fouling nations (top 10) — horizontal bar.
    const fr = (lastDisc.foulsRanking || []).slice(0, 10);
    upsert("chart-fouls", "bar",
      fr.map((x) => x.name), fr.map((x) => x.fouls), "Faltas",
      { horizontal: true, color: t.live });

    // Players with most yellow cards (top 10) — horizontal bar.
    const yc = lastDisc.yellow || [];
    upsert("chart-cards", "bar",
      yc.map((x) => x.name), yc.map((x) => x.cards), "Amarillas",
      { horizontal: true, color: t.gold });
  }
}

// Re-draw with current theme colors (call after toggling theme).
export function rethemeCharts() { renderCharts(); }
