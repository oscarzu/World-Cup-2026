# Real-time data proxy (API-Football → dashboard)

This Cloudflare Worker lets the static dashboard show **real, near-live** data
(live scores, live fouls/shots, top yellow-card players) from
[API-Football](https://www.api-football.com/) **without exposing your API key**
in the browser, and without CORS errors.

```
browser ──▶ Cloudflare Worker (holds key, adds CORS, caches) ──▶ API-Football
```

## 1. Get an API-Football key

1. Create a free account at https://dashboard.api-football.com/ (direct
   `api-sports.io` plan — **not** the RapidAPI variant, which uses a different
   header).
2. Copy your API key. The free plan allows **100 requests/day** — the Worker
   caches responses (20s for live, 30min otherwise) to stay within it.

## 2. Deploy the Worker

You need Node.js installed. From this `worker/` folder:

```bash
npm install -g wrangler        # or: npm i -D wrangler
wrangler login                 # opens the browser to authorize Cloudflare
wrangler secret put API_FOOTBALL_KEY   # paste your key when prompted (stays server-side)
wrangler deploy
```

`wrangler deploy` prints your Worker URL, e.g.:

```
https://wc26-football-proxy.<your-subdomain>.workers.dev
```

(Optional, recommended) Lock CORS to your site: edit `wrangler.toml`, uncomment
the `[vars]` block, set `ALLOW_ORIGIN = "https://oscarzu.github.io"`, then
`wrangler deploy` again.

## 3. Point the dashboard at the Worker

Edit **`js/config.js`** and set:

```js
LIVE_PROXY_URL: "https://wc26-football-proxy.<your-subdomain>.workers.dev",
```

Commit & push. That's it — when a proxy URL is present the dashboard switches to
the live provider automatically:

- **En vivo**: live fixtures with elapsed minute, goal timeline, and live
  **fouls / shots on goal** per team.
- **Estadísticas → Jugadores con más amarillas**: real top yellow-card list.
- The footer shows `Fuente: API-Football (en vivo)`.

If the proxy is empty, unreachable, or rate-limited, the dashboard silently
falls back to the bundled curated data — it never hard-fails.

## Endpoints the Worker allows (read-only)

`/fixtures`, `/fixtures/statistics`, `/fixtures/events`, `/players/topscorers`,
`/players/topyellowcards`, `/players/topredcards`, `/standings`,
`/teams/statistics` — all under league `1` (FIFA World Cup), season `2026`.

## Quota note

Per-team, full-tournament aggregates (e.g. total fouls per nation across all
104 matches) would require one `/fixtures/statistics` call per fixture, which
can exceed the free 100/day quota. The dashboard therefore keeps the curated
`data/teamstats.json` for the tournament-wide fouls table/efficacy, and uses
the live provider for the cheap, high-value calls (live matches + the
`topyellowcards` leaderboard). Upgrade your API-Football plan if you want to
aggregate everything live.
