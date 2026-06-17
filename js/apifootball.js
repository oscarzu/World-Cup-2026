// apifootball.js — optional real-time layer.
// Talks to a Cloudflare Worker proxy (see worker/) that holds the API-Football
// key server-side. Every function degrades gracefully: if the proxy is not
// configured or fails, callers fall back to the bundled curated data.

import { CONFIG } from "./config.js";

const LEAGUE = CONFIG.LIVE_LEAGUE ?? 1;   // FIFA World Cup
const SEASON = CONFIG.LIVE_SEASON ?? 2026;

export function liveEnabled() {
  return !!(CONFIG.LIVE_PROXY_URL && CONFIG.LIVE_PROXY_URL.trim());
}

async function api(path, params = {}) {
  const base = CONFIG.LIVE_PROXY_URL.replace(/\/+$/, "");
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${base}${path}${qs ? "?" + qs : ""}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
  const json = await res.json();
  return json.response || [];
}

const LIVE_SHORT = new Set(["1H", "2H", "HT", "ET", "BT", "P", "LIVE"]);
function mapStatus(short) {
  if (LIVE_SHORT.has(short)) return "live";
  if (["FT", "AET", "PEN"].includes(short)) return "finished";
  return "scheduled";
}

// API-Football fixture (+ optional events/statistics) -> app match shape.
function mapFixture(fx, events = [], stats = []) {
  const hId = fx.teams.home.id, aId = fx.teams.away.id;
  const goals = (events || [])
    .filter((e) => e.type === "Goal" && !/missed/i.test(e.detail || ""))
    .map((e) => ({
      team: e.team?.id === hId ? "home" : "away",
      name: e.player?.name || "",
      minute: String(e.time?.elapsed ?? ""),
      penalty: /penalty/i.test(e.detail || ""),
    }));
  const stat = (teamId, type) => {
    const t = (stats || []).find((s) => s.team?.id === teamId);
    const row = t?.statistics?.find((x) => x.type === type);
    return row && row.value != null ? Number(row.value) || 0 : null;
  };
  return {
    id: "af" + fx.fixture.id,
    round: fx.league?.round || "",
    date: (fx.fixture?.date || "").slice(0, 10),
    home: { name: fx.teams.home.name },
    away: { name: fx.teams.away.name },
    score: { home: fx.goals.home, away: fx.goals.away },
    status: mapStatus(fx.fixture?.status?.short),
    elapsed: fx.fixture?.status?.elapsed ?? null,
    ground: fx.fixture?.venue?.name || "",
    goals,
    stats: {
      home: { fouls: stat(hId, "Fouls"), shots: stat(hId, "Shots on Goal") },
      away: { fouls: stat(aId, "Fouls"), shots: stat(aId, "Shots on Goal") },
    },
  };
}

// Live matches now, enriched with events + statistics. Returns [] on failure.
export async function fetchLiveMatches() {
  const fixtures = await api("/fixtures", { league: LEAGUE, season: SEASON, live: "all" });
  const out = [];
  for (const fx of fixtures) {
    let events = [], stats = [];
    try { events = await api("/fixtures/events", { fixture: fx.fixture.id }); } catch (_) { /* optional */ }
    try { stats = await api("/fixtures/statistics", { fixture: fx.fixture.id }); } catch (_) { /* optional */ }
    out.push(mapFixture(fx, events, stats));
  }
  return out;
}

// Real top yellow-card players -> [{ name, country, cards }].
export async function fetchTopYellowCards() {
  const rows = await api("/players/topyellowcards", { league: LEAGUE, season: SEASON });
  return rows.map((r) => ({
    name: r.player?.name,
    country: r.statistics?.[0]?.team?.name,
    cards: (r.statistics || []).reduce((n, s) => n + (s.cards?.yellow || 0), 0),
  })).filter((x) => x.name && x.cards).slice(0, 10);
}
