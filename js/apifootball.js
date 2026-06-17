// apifootball.js — optional real-time layer.
// Reads pre-computed snapshots from the Cloudflare Worker (see worker/). The
// Worker's cron is the only thing that calls API-Football and stores the
// result in KV, so every visitor reads the SAME data with zero API cost here.
// All functions degrade gracefully: on any failure callers keep curated data.

import { CONFIG } from "./config.js";

export function liveEnabled() {
  return !!(CONFIG.LIVE_PROXY_URL && CONFIG.LIVE_PROXY_URL.trim());
}

async function getJSON(path) {
  const base = CONFIG.LIVE_PROXY_URL.replace(/\/+$/, "");
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
  return res.json();
}

// Shared snapshot: { updatedAt, live: [match…], yellowCards: [{name,country,cards}] }
// `live` items already match the app's match shape (mapped server-side).
export async function fetchSnapshot() {
  const s = await getJSON("/snapshot");
  return {
    updatedAt: s.updatedAt ?? null,
    live: Array.isArray(s.live) ? s.live : [],
    yellowCards: Array.isArray(s.yellowCards) ? s.yellowCards : [],
  };
}

// Our own accumulated per-team dataset: { teams: { name: {fouls, shotsOnTarget, goals} } }
export async function fetchLiveTeamStats() {
  const t = await getJSON("/teamstats");
  return t && t.teams ? t.teams : {};
}
