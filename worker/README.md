# Shared real-time collector (API-Football → KV → dashboard)

This Cloudflare Worker turns API-Football into a **single shared source of
truth** for the dashboard:

```
            (every 5 min, ONE consumer)              (unlimited reads, 0 API cost)
Cron Trigger ─────────────────────────▶ Worker ──▶ KV store ──▶ every visitor's browser
                                          │
                                          └─ accumulates our own dataset (agg)
```

- A **Cron Trigger** runs the Worker on a schedule and calls API-Football
  **once**, then stores the normalized result in **KV**.
- Browsers only **read** the stored snapshot, so everyone sees the **same data**
  (even after a refresh) and API usage does **not** grow with traffic.
- A **daily budget counter** caps upstream calls (`MAX_DAILY`, default 95) so you
  never blow the free 100/day quota — once spent, the last snapshot keeps serving.
- Each run also merges live fouls/shots/goals into `agg`, building **your own
  dataset** over the tournament (served at `/teamstats`).

## 1. Get an API-Football key
Create a free account at https://dashboard.api-football.com/ (the direct
`api-sports.io` plan, not RapidAPI) and copy your key.

## 2. Create the KV store (once)
From this `worker/` folder:
```bash
npx wrangler kv namespace create WC26
```
It prints something like:
```
[[kv_namespaces]]
binding = "WC26"
id = "abcd1234..."
```
Copy that `id` into **`wrangler.toml`** (replace `PASTE_YOUR_KV_NAMESPACE_ID_HERE`).

## 3. Set the secret + deploy
```bash
npx wrangler login                       # if not already
npx wrangler secret put API_FOOTBALL_KEY # paste your key (stays server-side)
npx wrangler deploy                      # registers the worker, KV binding and 5-min cron
```

## 4. First fill (optional)
The cron fires every 5 min; to populate immediately, open once:
```
https://wc26-football-proxy.<your-subdomain>.workers.dev/refresh
```
Then check it stored data:
```
https://wc26-football-proxy.<your-subdomain>.workers.dev/health
```
You should see `apiCallsUsedToday` and a `snapshotUpdatedAt` timestamp.

## 5. Point the dashboard at it
In **`js/config.js`** set `LIVE_PROXY_URL` to your Worker URL, commit & push.
(That's already done if you've configured it before — no change needed.)

## Routes (read-only, browser-facing)
- `GET /snapshot`   → `{ updatedAt, live:[…], yellowCards:[…] }` (what the UI reads)
- `GET /teamstats`  → `{ teams: { name: { fouls, shotsOnTarget, goals } } }` (our own accumulated data)
- `GET /health`     → status + API calls used today
- `GET /refresh`    → force a collection now (still respects the daily budget)

## Tuning (in `wrangler.toml` → `[vars]`)
- `MAX_DAILY` — hard cap on API-Football calls/day (default 95).
- `ENRICH_LIMIT` — how many live fixtures get fouls/shots each run (default 4).
- Cron cadence — edit `crons = ["*/5 * * * *"]` (e.g. `*/10` to stretch the quota).
- `ALLOW_ORIGIN` — lock CORS to your site instead of `*`.

For sustained 24/7 live coverage, raise the cadence or upgrade the API-Football
plan; the budget counter guarantees you never exceed the free tier regardless.
