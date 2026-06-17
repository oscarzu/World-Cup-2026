// Cloudflare Worker — API-Football proxy for the World Cup 2026 dashboard.
//
// Why: the dashboard is a static site (GitHub Pages). Calling API-Football
// directly would expose your API key in the browser and is blocked by CORS.
// This Worker keeps the key server-side (as a secret), forwards a small
// whitelist of read-only endpoints, adds CORS headers, and caches responses
// at the edge to protect your daily quota.
//
// Deploy: see worker/README.md.

const API_BASE = "https://v3.football.api-sports.io";

// Only these read-only endpoints may be proxied.
const ALLOW = new Set([
  "/fixtures",
  "/fixtures/statistics",
  "/fixtures/events",
  "/players/topscorers",
  "/players/topyellowcards",
  "/players/topredcards",
  "/standings",
  "/teams/statistics",
]);

export default {
  async fetch(request, env, ctx) {
    const origin = env.ALLOW_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "GET") {
      return json({ error: "method not allowed" }, 405, cors);
    }
    if (!env.API_FOOTBALL_KEY) {
      return json({ error: "API_FOOTBALL_KEY secret not set on the worker" }, 500, cors);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (!ALLOW.has(path)) {
      return json({ error: "endpoint not allowed", path }, 403, cors);
    }

    const target = API_BASE + path + (url.search || "");
    // Cache aggressively to respect the free tier (10 req/min · 100 req/day).
    let ttl = 1800; // static data (standings, top scorers): 30 min
    if (url.searchParams.get("live") === "all") ttl = 300;          // live list: 5 min
    else if (path === "/fixtures/statistics" || path === "/fixtures/events") ttl = 300; // live detail: 5 min

    // Edge cache keyed by the upstream URL.
    const cache = caches.default;
    const cacheKey = new Request(target);
    let cached = await cache.match(cacheKey);
    if (cached) return withCors(cached, cors);

    const upstream = await fetch(target, {
      headers: { "x-apisports-key": env.API_FOOTBALL_KEY },
      cf: { cacheTtl: ttl, cacheEverything: true },
    });
    const body = await upstream.text();
    const resp = new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": `public, max-age=${ttl}`,
      },
    });
    if (upstream.ok) ctx.waitUntil(cache.put(cacheKey, resp.clone()));
    return withCors(resp, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
  });
}

function withCors(resp, cors) {
  const out = new Response(resp.body, resp);
  for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
  return out;
}
