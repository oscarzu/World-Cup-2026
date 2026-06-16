// charts.js — Chart.js visualizations. Charts re-theme on dark/light toggle.

const charts = {};

function theme() {
  const cs = getComputedStyle(document.documentElement);
  return {
    accent: cs.getPropertyValue("--accent").trim() || "#00d680",
    grid: cs.getPropertyValue("--border").trim() || "#262b34",
    text: cs.getPropertyValue("--muted").trim() || "#8b94a3",
  };
}

function baseOpts(t) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: t.grid }, ticks: { color: t.text, font: { size: 10 } } },
      y: { grid: { color: t.grid }, ticks: { color: t.text, font: { size: 10 } }, beginAtZero: true },
    },
  };
}

function upsert(id, type, labels, data, label) {
  if (typeof Chart === "undefined") return; // CDN not ready yet
  const el = document.getElementById(id);
  if (!el) return;
  const t = theme();
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(el, {
    type,
    data: {
      labels,
      datasets: [{
        label, data,
        backgroundColor: t.accent,
        borderColor: t.accent,
        borderRadius: 6,
        tension: 0.35,
        pointRadius: 3,
        fill: false,
      }],
    },
    options: baseOpts(t),
  });
}

let last = null;

export function renderCharts(stats) {
  if (stats) last = stats;
  if (!last) return;
  const md = last.byMatchday;
  upsert("chart-overview", "line",
    md.map(([k]) => `J${k}`), md.map(([, v]) => v), "Goles");
  upsert("chart-matchdays", "bar",
    md.map(([k]) => `J${k}`), md.map(([, v]) => v), "Goles");
  upsert("chart-groups", "bar",
    last.byGroup.map(([k]) => k.replace("Group ", "")), last.byGroup.map(([, v]) => v), "Goles");
}

// Re-draw with current theme colors (call after toggling theme).
export function rethemeCharts() { renderCharts(); }
