# Shared live collector (ESPN → KV → dashboard)

This Cloudflare Worker gives the dashboard **real World Cup 2026 data for free**,
sourced from ESPN.

```
            (every 3 min, ONE consumer)              (unlimited reads, 0 cost)
Cron Trigger ─────────────────────────▶ Worker ──▶ KV store ──▶ every visitor's browser
                                          │
                                          └─ accumulates our own dataset (agg)
```

> KV is written **only when the content changes**, to stay within the free tier
> (1000 puts/day).

- A **Cron Trigger** runs the Worker, calls ESPN **once**, and stores a
  normalized snapshot in **KV**.
- Browsers only **read** that snapshot → everyone sees the **same data**, even
  after refreshing, and usage does **not** grow with traffic.
- Each run also merges live fouls/shots/goals and yellow-card events into `agg`,
  building **your own dataset** over the tournament (served at `/teamstats`).

> The source offers no uptime guarantee. If it ever changes, the dashboard
> simply falls back to the bundled data.

## 1. Create the KV store (once)
From this `worker/` folder:
```bash
npx wrangler kv namespace create WC26
```
Copy the printed `id` into **`wrangler.toml`** (the `id = "…"` line under
`[[kv_namespaces]]`). _(You've already done this.)_

## 2. Deploy
```bash
npx wrangler login        # if needed
npx wrangler deploy        # registers the worker, KV binding and 3-min cron
```
No secret/API key is required anymore. (You can remove the old one with
`npx wrangler secret delete API_FOOTBALL_KEY`.)

## 3. Fill + verify
```
https://<your-worker>.<your-subdomain>.workers.dev/refresh   ← collect now
https://<your-worker>.<your-subdomain>.workers.dev/health    ← see status
```
`/refresh` returns diagnostics, e.g.:
```json
{ "ok": true, "source": "espn", "events": 4, "live": 2, "enriched": 2, "yellowCards": 7, "fetches": 3, "error": null }
```
- `events` > 0 → ESPN returned the day's matches.
- `live` → matches in play right now (0 is normal outside match hours).
- `snapshotUpdatedAt` in `/health` should be a timestamp (not null).

## 4. Point the dashboard at it
`js/config.js` → `LIVE_PROXY_URL` already holds your Worker URL. Done.

## Routes
- `GET /snapshot`      → `{ updatedAt, live:[…], yellowCards:[…] }` (what the UI reads)
- `GET /teamstats`     → `{ teams: { name: { fouls, shotsOnTarget, goals, red, matches } }, addedTime }`
  - `addedTime` = real stoppage time measured from ESPN's match clock
    (`{ avgPerMatch, matches, byPhase, ref, isEstimate:false }`), or `null` until
    at least one match is measurable.
- `GET /efficacy.json` → `{ byPhase:[{ phase, perPhase:{best,worst}, accumulated:{…} }] }`
- `GET /calendar.ics`  → subscribable knockout calendar (`?lang=es|en`)
- `GET /health`        → status + last-run diagnostics
- `GET /refresh`       → force a collection now
- `GET /rebuild`       → backfill every played match (`?reset=1` starts fresh)

## Tuning (`wrangler.toml` → `[vars]`)
- `ENRICH_LIMIT` — live matches enriched with fouls/shots/cards per run (default 6).
- `MAX_DAILY` — safety cap on ESPN fetches/day (default 2000).
- Cron cadence — `crons = ["*/3 * * * *"]`.
- `ALLOW_ORIGIN` — lock CORS to your site instead of `*`.
