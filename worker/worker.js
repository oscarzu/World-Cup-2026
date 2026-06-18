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
      const today = new Date().toISOString().slice(0, 10);
      const used = Number((await env.WC26.get(`fetches:${today}`)) || 0);
      const snap = JSON.parse((await env.WC26.get("snapshot")) || "{}");
      const lastResult = JSON.parse((await env.WC26.get("lastResult")) || "null");
      return json({ ok: true, source: "espn", date: today, fetchesToday: used,
        snapshotUpdatedAt: snap.updatedAt || null, lastResult }, 200, cors);
    }
    if (path === "/refresh") { const r = await collect(env); return json(r, 200, cors); }

    return json({ error: "not found", routes: ["/snapshot", "/teamstats", "/health", "/refresh"] }, 404, cors);
  },

  // ---- Cron: the only consumer of the upstream API ----
  async scheduled(event, env, ctx) { ctx.waitUntil(collect(env)); },
};

async function collect(env) {
  const result = { ok: false, source: "espn", events: 0, live: 0, enriched: 0, yellowCards: 0, fetches: 0, error: null };
  if (!env.WC26) { result.error = "KV namespace 'WC26' not bound"; return result; }
  const MAX = Number(env.MAX_DAILY || 2000);
  const ENRICH = Number(env.ENRICH_LIMIT || 6);

  const today = new Date().toISOString().slice(0, 10);
  const bKey = `fetches:${today}`;
  let used = Number((await env.WC26.get(bKey)) || 0);
  const startUsed = used;
  if (used >= MAX) { result.error = `daily fetch cap reached (${used}/${MAX})`; return result; }

  const getJSON = async (url) => {
    used++;
    const r = await fetch(url, { headers: { "User-Agent": "wc26-dashboard/1.0", "Accept": "application/json" } });
    if (!r.ok) throw new Error("ESPN HTTP " + r.status);
    return r.json();
  };

  try {
    const sb = await getJSON(`${ESPN}/scoreboard`);
    const events = sb.events || [];
    result.events = events.length;
    const agg = JSON.parse((await env.WC26.get("agg")) || '{"fixtures":{}}');
    const live = [];
    let enriched = 0;

    for (const ev of events) {
      const state = ev.status?.type?.state;
      let summary = null;
      if (state === "in" && enriched < ENRICH && used < MAX) {
        try { summary = await getJSON(`${ESPN}/summary?event=${ev.id}`); enriched++; } catch (_) {}
      }
      const m = mapEvent(ev, summary);
      if (m.status === "live") live.push(m);
      if (summary) agg.fixtures[ev.id] = extractAgg(ev, summary, m); // build our own dataset
    }
    result.live = live.length;
    result.enriched = enriched;

    agg.updatedAt = Date.now();
    const yellowCards = aggregateCards(agg);
    result.yellowCards = yellowCards.length;

    await env.WC26.put("snapshot", JSON.stringify({ updatedAt: Date.now(), live, yellowCards }));
    await env.WC26.put("agg", JSON.stringify(agg));
    result.ok = true;
  } catch (e) {
    result.error = String(e && e.message ? e.message : e);
  } finally {
    result.fetches = used - startUsed;
    await env.WC26.put(bKey, String(used), { expirationTtl: 172800 });
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
  const yc = [];
  for (const e of (summary?.keyEvents || [])) {
    const txt = (e.type?.text || "").toLowerCase();
    if (!txt.includes("yellow")) continue;
    const side = sideOf(e.team?.id, home, away);
    const country = side === "home" ? m.home.name : side === "away" ? m.away.name : "";
    const who = athleteName(e);
    if (who) yc.push({ name: who, country });
  }
  return {
    home: { name: m.home.name, fouls: m.stats.home.fouls || 0, shots: m.stats.home.shots || 0, goals: m.score.home || 0 },
    away: { name: m.away.name, fouls: m.stats.away.fouls || 0, shots: m.stats.away.shots || 0, goals: m.score.away || 0 },
    yc,
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
