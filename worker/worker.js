// Cloudflare Worker — World Cup 2026 live collector using ESPN's FREE public API.
//
// Why ESPN: it serves the 2026 World Cup (`fifa.world`) with no API key and no
// season restriction (unlike API-Football's free plan). A Cron Trigger collects
// once, stores a normalized snapshot in KV, and browsers read that shared
// snapshot — identical for everyone, refresh-proof, and independent of traffic.
// It also accumulates our OWN dataset (per-team fouls/shots/goals + per-player
// yellow cards) from match summaries, exposed at /teamstats and in the snapshot.
//
// Unofficial endpoints (no SLA) but free and key-less. Deploy: see README.md.

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";

export default {
  // ---- HTTP: browsers read stored snapshots (no upstream calls here) ----
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
      const agg = JSON.parse((await env.WC26.get("agg")) || '{"fixtures":{}}');
      const snap = JSON.parse((await env.WC26.get("snapshot")) || "{}");
      const lastResult = JSON.parse((await env.WC26.get("lastResult")) || "null");
      return json({ ok: true, source: "espn",
        capturedMatches: Object.keys(agg.fixtures || {}).length,
        snapshotUpdatedAt: snap.updatedAt || null, lastResult }, 200, cors);
    }
    if (path === "/refresh") { const r = await collect(env); return json(r, 200, cors); }
    // Audit/rebuild: backfill every played match (chunked). ?reset=1 starts fresh.
    if (path === "/rebuild") {
      const reset = new URL(request.url).searchParams.get("reset") === "1";
      const r = await collect(env, { reset, backfillLimit: 40 });
      return json(r, 200, cors);
    }

    return json({ error: "not found", routes: ["/snapshot", "/teamstats", "/health", "/refresh", "/rebuild"] }, 404, cors);
  },

  // ---- Cron: the only consumer of the upstream API ----
  async scheduled(event, env, ctx) { ctx.waitUntil(collect(env)); },
};

async function collect(env, { reset = false, backfillLimit } = {}) {
  const result = { ok: false, source: "espn", events: 0, totalPlayed: 0, live: 0,
    enriched: 0, backfilled: 0, captured: 0, yellowCards: 0, calls: 0, error: null };
  if (!env.WC26) { result.error = "KV namespace 'WC26' not bound"; return result; }
  const ENRICH = Number(env.ENRICH_LIMIT || 6);
  const BATCH = backfillLimit ?? Number(env.BACKFILL_BATCH || 12);
  const SUBREQ_MAX = 45; // Cloudflare free plan allows 50 subrequests per invocation
  const RANGE = `${env.WC_START || "20260611"}-${env.WC_END || "20260719"}`;

  let calls = 0;
  const getJSON = async (url) => {
    calls++;
    const r = await fetch(url, { headers: { "User-Agent": "wc26-dashboard/1.0", "Accept": "application/json" } });
    if (!r.ok) throw new Error("ESPN HTTP " + r.status);
    return r.json();
  };

  try {
    // Full tournament fixture universe (one call).
    const sb = await getJSON(`${ESPN}/scoreboard?dates=${RANGE}&limit=400`);
    const events = sb.events || [];
    result.events = events.length;
    result.totalPlayed = events.filter((e) => ["in", "post"].includes(e.status?.type?.state)).length;

    const agg = reset ? { fixtures: {} } : JSON.parse((await env.WC26.get("agg")) || '{"fixtures":{}}');
    const live = [];

    // 1) Live matches: enrich up to ENRICH, always list them.
    for (const ev of events) {
      if (ev.status?.type?.state !== "in") continue;
      let summary = null;
      if (result.enriched < ENRICH && calls < SUBREQ_MAX) {
        try { summary = await getJSON(`${ESPN}/summary?event=${ev.id}`); result.enriched++; } catch (_) {}
      }
      const m = mapEvent(ev, summary);
      live.push(m);
      if (summary) agg.fixtures[ev.id] = extractAgg(ev, summary, m);
    }
    result.live = live.length;

    // 2) Backfill finished matches we don't have yet (so the dataset becomes
    //    the complete, exact tournament record over a few runs).
    for (const ev of events) {
      if (result.backfilled >= BATCH || calls >= SUBREQ_MAX) break;
      if (ev.status?.type?.state !== "post" || agg.fixtures[ev.id]) continue;
      let summary = null;
      try { summary = await getJSON(`${ESPN}/summary?event=${ev.id}`); } catch (_) { continue; }
      const m = mapEvent(ev, summary);
      agg.fixtures[ev.id] = extractAgg(ev, summary, m);
      result.backfilled++;
    }

    agg.updatedAt = Date.now();
    result.captured = Object.keys(agg.fixtures).length;
    const yellowCards = aggregateCards(agg);
    result.yellowCards = yellowCards.length;

    await env.WC26.put("snapshot", JSON.stringify({ updatedAt: Date.now(), live, yellowCards }));
    await env.WC26.put("agg", JSON.stringify(agg));
    result.ok = true;
  } catch (e) {
    result.error = String(e && e.message ? e.message : e);
  } finally {
    result.calls = calls;
    await env.WC26.put("lastResult", JSON.stringify({ ...result, at: Date.now() }));
  }
  return result;
}

// ---- ESPN → app shape mapping ----
function num(v) { const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; }

function sideOf(teamId, home, away) {
  const id = String(teamId ?? "");
  if (id && id === String(home.team?.id)) return "home";
  if (id && id === String(away.team?.id)) return "away";
  return null;
}

function mapEvent(ev, summary) {
  const comp = ev.competitions?.[0] || {};
  const cs = comp.competitors || [];
  const home = cs.find((c) => c.homeAway === "home") || cs[0] || {};
  const away = cs.find((c) => c.homeAway === "away") || cs[1] || {};
  const state = ev.status?.type?.state;
  const status = state === "in" ? "live" : state === "post" ? "finished" : "scheduled";
  return {
    id: "espn" + ev.id,
    round: comp.notes?.[0]?.headline || ev.season?.slug || "",
    date: (ev.date || "").slice(0, 10),
    home: { name: home.team?.displayName || home.team?.name || "" },
    away: { name: away.team?.displayName || away.team?.name || "" },
    score: { home: num(home.score), away: num(away.score) },
    status,
    clock: ev.status?.type?.shortDetail || ev.status?.displayClock || null,
    ground: comp.venue?.fullName || "",
    goals: extractGoals(comp, home, away, summary),
    stats: extractStats(summary, home, away),
  };
}

function eventList(comp, summary) {
  if (summary?.keyEvents?.length) return summary.keyEvents;
  return comp.details || [];
}
function athleteName(e) {
  return e.athletesInvolved?.[0]?.displayName
    || e.participants?.[0]?.athlete?.displayName
    || e.athletesInvolved?.[0]?.fullName || "";
}
function extractGoals(comp, home, away, summary) {
  const out = [];
  for (const e of eventList(comp, summary)) {
    const txt = (e.type?.text || "").toLowerCase();
    const isGoal = e.scoringPlay === true || (txt.includes("goal") && !txt.includes("own"));
    const isOwn = txt.includes("own goal");
    if (!isGoal && !isOwn) continue;
    const side = sideOf(e.team?.id, home, away);
    if (!side) continue;
    out.push({
      team: side,
      name: athleteName(e) || (isOwn ? "(autogol)" : ""),
      minute: String((e.clock?.displayValue || "").replace("'", "")),
      penalty: /penalt/i.test(txt),
    });
  }
  return out;
}

function statVal(arr, keys) {
  const norm = (s) => (s || "").toLowerCase().replace(/[^a-z]/g, "");
  const want = keys.map(norm);
  for (const s of arr || []) {
    const n = norm(s.name || s.abbreviation || s.label);
    if (want.includes(n)) return num(s.displayValue ?? s.value);
  }
  for (const s of arr || []) {
    const n = norm(s.name || s.label);
    if (want.some((w) => n.includes(w))) return num(s.displayValue ?? s.value);
  }
  return null;
}
function teamStatsArr(summary, side) {
  const teams = summary?.boxscore?.teams || [];
  const t = teams.find((t) => String(t.team?.id) === String(side.team?.id));
  return t?.statistics || [];
}
function extractStats(summary, home, away) {
  const hs = teamStatsArr(summary, home), as = teamStatsArr(summary, away);
  return {
    home: { fouls: statVal(hs, ["foulsCommitted", "fouls"]), shots: statVal(hs, ["shotsOnTarget", "shotsOnGoal"]) },
    away: { fouls: statVal(as, ["foulsCommitted", "fouls"]), shots: statVal(as, ["shotsOnTarget", "shotsOnGoal"]) },
  };
}

function extractAgg(ev, summary, m) {
  const comp = ev.competitions?.[0] || {};
  const cs = comp.competitors || [];
  const home = cs.find((c) => c.homeAway === "home") || cs[0] || {};
  const away = cs.find((c) => c.homeAway === "away") || cs[1] || {};
  const yc = []; let homeRed = 0, awayRed = 0;
  for (const e of (summary?.keyEvents || [])) {
    const txt = (e.type?.text || "").toLowerCase();
    const side = sideOf(e.team?.id, home, away);
    if (txt.includes("yellow")) {
      const country = side === "home" ? m.home.name : side === "away" ? m.away.name : "";
      const who = athleteName(e);
      if (who) yc.push({ name: who, country });
    } else if (txt.includes("red")) {
      if (side === "home") homeRed++; else if (side === "away") awayRed++;
    }
  }
  return {
    home: { name: m.home.name, fouls: m.stats.home.fouls || 0, shots: m.stats.home.shots || 0, goals: m.score.home || 0, red: homeRed },
    away: { name: m.away.name, fouls: m.stats.away.fouls || 0, shots: m.stats.away.shots || 0, goals: m.score.away || 0, red: awayRed },
    yc,
  };
}

function aggregateTeams(agg) {
  const teams = {};
  for (const id in (agg.fixtures || {})) {
    for (const side of ["home", "away"]) {
      const s = agg.fixtures[id][side];
      if (!s || !s.name) continue;
      const t = teams[s.name] || { fouls: 0, shotsOnTarget: 0, goals: 0, red: 0, matches: 0 };
      t.fouls += s.fouls; t.shotsOnTarget += s.shots; t.goals += s.goals;
      t.red += s.red || 0; t.matches += 1;
      teams[s.name] = t;
    }
  }
  return teams;
}
function aggregateCards(agg) {
  const c = {};
  for (const id in (agg.fixtures || {})) {
    for (const e of (agg.fixtures[id].yc || [])) {
      const k = e.name + "|" + (e.country || "");
      if (!c[k]) c[k] = { name: e.name, country: e.country, cards: 0 };
      c[k].cards++;
    }
  }
  return Object.values(c).sort((a, b) => b.cards - a.cards).slice(0, 10);
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } });
}
function raw(body, cors) {
  return new Response(body, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } });
}
