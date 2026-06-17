// Cloudflare Worker — API-Football collector + snapshot store (KV + Cron).
//
// Model: a Cron Trigger runs this Worker on a schedule (independent of any
// visitor), calls API-Football ONCE, normalizes the result, and stores it in
// KV. Browsers only READ the stored snapshot — so the data is identical for
// everyone, survives refreshes, and the API usage does NOT grow with traffic.
// A daily budget counter guarantees we never exceed the free 100/day quota.
//
// It also accumulates our OWN dataset: per-fixture fouls/shots/goals captured
// from the live feed are merged into `agg`, exposed at /teamstats.
//
// Deploy: see worker/README.md (needs a KV namespace + cron trigger).

const API_BASE = "https://v3.football.api-sports.io";

export default {
  // ---- HTTP: browsers read stored snapshots (no API calls here) ----
  async fetch(request, env, ctx) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "GET") return json({ error: "method not allowed" }, 405, cors);
    if (!env.WC26) return json({ error: "KV namespace 'WC26' not bound" }, 500, cors);

    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";

    if (path === "/snapshot") {
      const snap = await env.WC26.get("snapshot");
      return raw(snap || JSON.stringify({ updatedAt: null, live: [], yellowCards: [] }), cors);
    }
    if (path === "/teamstats") {
      const agg = JSON.parse((await env.WC26.get("agg")) || '{"fixtures":{}}');
      return json({ teams: aggregateTeams(agg), updatedAt: agg.updatedAt || null }, 200, cors);
    }
    if (path === "/health") {
      const today = new Date().toISOString().slice(0, 10);
      const used = Number((await env.WC26.get(`budget:${today}`)) || 0);
      const snap = JSON.parse((await env.WC26.get("snapshot")) || "{}");
      return json({ ok: true, date: today, apiCallsUsedToday: used, snapshotUpdatedAt: snap.updatedAt || null }, 200, cors);
    }
    // On-demand refresh (also respects the daily budget). Handy for first run.
    if (path === "/refresh") { await collect(env); return json({ ok: true }, 200, cors); }

    return json({ error: "not found", routes: ["/snapshot", "/teamstats", "/health", "/refresh"] }, 404, cors);
  },

  // ---- Cron: the only consumer of the upstream API ----
  async scheduled(event, env, ctx) {
    ctx.waitUntil(collect(env));
  },
};

// Pull from API-Football (budget-guarded) and persist snapshot + aggregates.
async function collect(env) {
  if (!env.API_FOOTBALL_KEY || !env.WC26) return;
  const LEAGUE = Number(env.LIVE_LEAGUE || 1);
  const SEASON = Number(env.LIVE_SEASON || 2026);
  const MAX = Number(env.MAX_DAILY || 95);
  const ENRICH = Number(env.ENRICH_LIMIT || 4);

  const today = new Date().toISOString().slice(0, 10);
  const bKey = `budget:${today}`;
  let used = Number((await env.WC26.get(bKey)) || 0);
  if (used >= MAX) return; // preserve quota; serve last stored snapshot

  const af = async (path, params) => {
    const u = new URL(API_BASE + path);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    used++;
    const r = await fetch(u, { headers: { "x-apisports-key": env.API_FOOTBALL_KEY } });
    const j = await r.json();
    if (j.errors && (Array.isArray(j.errors) ? j.errors.length : Object.keys(j.errors).length)) {
      throw new Error("api-football: " + JSON.stringify(j.errors));
    }
    return j.response || [];
  };

  try {
    const fixtures = await af("/fixtures", { league: LEAGUE, season: SEASON, live: "all" });
    const agg = JSON.parse((await env.WC26.get("agg")) || '{"fixtures":{}}');
    const live = [];

    for (let i = 0; i < fixtures.length; i++) {
      const fx = fixtures[i];
      let events = [], stats = [];
      if (i < ENRICH && used < MAX - 1) {
        try { events = await af("/fixtures/events", { fixture: fx.fixture.id }); } catch (_) {}
        try { stats = await af("/fixtures/statistics", { fixture: fx.fixture.id }); } catch (_) {}
      }
      live.push(mapFixture(fx, events, stats));
      if (stats.length) agg.fixtures[fx.fixture.id] = extractAgg(fx, stats); // build our own data
    }

    let yellowCards = [];
    if (used < MAX) {
      try {
        const rows = await af("/players/topyellowcards", { league: LEAGUE, season: SEASON });
        yellowCards = rows.map((r) => ({
          name: r.player?.name,
          country: r.statistics?.[0]?.team?.name,
          cards: (r.statistics || []).reduce((n, s) => n + (s.cards?.yellow || 0), 0),
        })).filter((x) => x.name && x.cards).slice(0, 10);
      } catch (_) {}
    }

    agg.updatedAt = Date.now();
    await env.WC26.put("snapshot", JSON.stringify({ updatedAt: Date.now(), live, yellowCards }));
    await env.WC26.put("agg", JSON.stringify(agg));
  } catch (_) {
    // leave the previous snapshot in place
  } finally {
    await env.WC26.put(bKey, String(used), { expirationTtl: 172800 });
  }
}

// ---- mapping helpers (server-side, so the client just consumes JSON) ----
const LIVE_SHORT = new Set(["1H", "2H", "HT", "ET", "BT", "P", "LIVE"]);
function mapStatus(s) {
  if (LIVE_SHORT.has(s)) return "live";
  if (["FT", "AET", "PEN"].includes(s)) return "finished";
  return "scheduled";
}
function mapFixture(fx, events, stats) {
  const hId = fx.teams.home.id, aId = fx.teams.away.id;
  const goals = (events || [])
    .filter((e) => e.type === "Goal" && !/missed/i.test(e.detail || ""))
    .map((e) => ({
      team: e.team?.id === hId ? "home" : "away",
      name: e.player?.name || "",
      minute: String(e.time?.elapsed ?? ""),
      penalty: /penalty/i.test(e.detail || ""),
    }));
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
      home: { fouls: stat(stats, hId, "Fouls"), shots: stat(stats, hId, "Shots on Goal") },
      away: { fouls: stat(stats, aId, "Fouls"), shots: stat(stats, aId, "Shots on Goal") },
    },
  };
}
function stat(stats, teamId, type) {
  const t = (stats || []).find((s) => s.team?.id === teamId);
  const row = t?.statistics?.find((x) => x.type === type);
  return row && row.value != null ? Number(row.value) || 0 : null;
}
function extractAgg(fx, stats) {
  const g = (teamId, type) => {
    const v = stat(stats, teamId, type);
    return v == null ? 0 : v;
  };
  return {
    home: { name: fx.teams.home.name, fouls: g(fx.teams.home.id, "Fouls"), shots: g(fx.teams.home.id, "Shots on Goal"), goals: fx.goals.home || 0 },
    away: { name: fx.teams.away.name, fouls: g(fx.teams.away.id, "Fouls"), shots: g(fx.teams.away.id, "Shots on Goal"), goals: fx.goals.away || 0 },
  };
}
function aggregateTeams(agg) {
  const teams = {};
  for (const id in (agg.fixtures || {})) {
    for (const side of ["home", "away"]) {
      const s = agg.fixtures[id][side];
      if (!s || !s.name) continue;
      const t = teams[s.name] || { fouls: 0, shotsOnTarget: 0, goals: 0 };
      t.fouls += s.fouls; t.shotsOnTarget += s.shots; t.goals += s.goals;
      teams[s.name] = t;
    }
  }
  return teams;
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } });
}
function raw(body, cors) {
  return new Response(body, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } });
}
