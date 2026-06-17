// api.js — data layer.
// Responsibilities:
//   1. Fetch the public-domain base dataset (with localStorage cache + offline fallback).
//   2. Normalize both providers to one source-agnostic shape.
//   3. Best-effort overlay of the live community API on top of the base data.
//   4. Derive match status (scheduled / live / finished) even without the live API.

import { CONFIG, FLAGS } from "./config.js";

const KNOCKOUT_ROUNDS = new Set([
  "Round of 32", "Round of 16", "Quarter-final",
  "Semi-final", "Match for third place", "Final",
]);

// ---- low-level cached fetch ------------------------------------------------

async function cachedFetch(url, ttl) {
  const key = `wc26:${url}`;
  try {
    const hit = JSON.parse(localStorage.getItem(key) || "null");
    if (hit && Date.now() - hit.t < ttl) return hit.d;
  } catch (_) { /* ignore corrupt cache */ }

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const data = await res.json();
  try {
    localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data }));
  } catch (_) { /* quota / private mode — non-fatal */ }
  return data;
}

// ---- helpers ---------------------------------------------------------------

export function flagUrl(team) {
  const code = FLAGS[team];
  return code ? `https://flagcdn.com/${code}.svg` : null;
}

// Parse "13:00 UTC-6" + "2026-06-11" into an absolute Date (UTC) for kickoff.
export function kickoffDate(match) {
  if (!match.date || !match.time) return null;
  const m = match.time.match(/(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})?/);
  if (!m) return null;
  const [, hh, mm, off] = m;
  const offset = off ? parseInt(off, 10) : 0;
  // Local wall-clock minus offset == UTC.
  const utcHour = parseInt(hh, 10) - offset;
  const [Y, Mo, D] = match.date.split("-").map(Number);
  return new Date(Date.UTC(Y, Mo - 1, D, utcHour, parseInt(mm, 10)));
}

// Human kickoff label in the configured timezone (CST), e.g. "13:00 CST".
// Falls back to the raw string if the time can't be parsed.
export function kickoffLabel(match) {
  const ko = kickoffDate(match);
  if (!ko) return match.time || "";
  const t = ko.toLocaleTimeString("es-MX", {
    timeZone: CONFIG.TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return `${t} ${CONFIG.TIMEZONE_LABEL}`;
}

// Kickoff date + time in the configured timezone, e.g. "jue 11 jun · 13:00 CST".
export function kickoffDateTime(match) {
  const ko = kickoffDate(match);
  if (!ko) return "";
  const d = ko.toLocaleDateString("es-MX", {
    timeZone: CONFIG.TIMEZONE, weekday: "short", day: "numeric", month: "short",
  });
  return `${d} · ${kickoffLabel(match)}`;
}

function deriveStatus(match, score) {
  if (score && score.home != null && score.away != null) return "finished";
  const ko = kickoffDate(match);
  if (!ko) return "scheduled";
  const now = Date.now();
  const elapsed = now - ko.getTime();
  // Live window: from kickoff until ~2h15m after, while still unscored.
  if (elapsed >= 0 && elapsed <= 135 * 60 * 1000) return "live";
  return "scheduled";
}

function normalizeGoals(arr, side) {
  return (arr || []).map((g) => ({
    team: side, name: g.name, minute: String(g.minute ?? ""),
    penalty: !!g.penalty,
  }));
}

// Convert one base-dataset match into the normalized shape.
function normalizeMatch(raw, idx) {
  const ft = raw.score?.ft;
  const ht = raw.score?.ht;
  const pen = raw.score?.p;
  const score = Array.isArray(ft)
    ? {
        home: ft[0], away: ft[1],
        htHome: ht?.[0], htAway: ht?.[1],
        penHome: pen?.[0], penAway: pen?.[1],
      }
    : null;

  const stage = KNOCKOUT_ROUNDS.has(raw.round) ? "knockout" : "group";
  const mdMatch = /Matchday (\d+)/.exec(raw.round || "");

  return {
    id: `m${idx}`,
    round: raw.round || "",
    matchday: mdMatch ? Number(mdMatch[1]) : null,
    stage,
    date: raw.date || "",
    time: raw.time || "",
    group: raw.group || null,
    ground: raw.ground || "",
    home: { name: raw.team1, code: FLAGS[raw.team1] || null },
    away: { name: raw.team2, code: FLAGS[raw.team2] || null },
    score,
    status: deriveStatus(raw, score),
    goals: [
      ...normalizeGoals(raw.goals1, "home"),
      ...normalizeGoals(raw.goals2, "away"),
    ],
  };
}

// ---- live overlay (best-effort) -------------------------------------------

// Match live games to base matches by team-name pair, updating score/status.
// Defensive: the community API shape is not guaranteed, so everything is guarded.
function applyLiveOverlay(matches, liveRaw) {
  const games = Array.isArray(liveRaw) ? liveRaw
    : Array.isArray(liveRaw?.games) ? liveRaw.games
    : Array.isArray(liveRaw?.data) ? liveRaw.data
    : [];
  if (!games.length) return { applied: 0 };

  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");
  const byPair = new Map();
  for (const m of matches) byPair.set(norm(m.home.name) + "|" + norm(m.away.name), m);

  let applied = 0;
  for (const g of games) {
    const t1 = g.team1_en || g.home || g.team1 || g.homeTeam;
    const t2 = g.team2_en || g.away || g.team2 || g.awayTeam;
    const target = byPair.get(norm(t1) + "|" + norm(t2));
    if (!target) continue;
    const h = Number(g.score1 ?? g.homeScore ?? g.home_goals);
    const a = Number(g.score2 ?? g.awayScore ?? g.away_goals);
    const st = String(g.status || g.state || "").toLowerCase();
    if (!Number.isNaN(h) && !Number.isNaN(a)) {
      target.score = { ...(target.score || {}), home: h, away: a };
    }
    if (/(live|inplay|playing|1st|2nd|half)/.test(st)) target.status = "live";
    else if (/(finish|ended|ft|full)/.test(st)) target.status = "finished";
    applied++;
  }
  return { applied };
}

// ---- public API ------------------------------------------------------------

export async function loadBase() {
  let raw, source, online = true;
  try {
    raw = await cachedFetch(CONFIG.BASE_DATA_URL, CONFIG.BASE_TTL);
    source = "live source (openfootball)";
  } catch (_) {
    raw = await cachedFetch(CONFIG.FALLBACK_DATA_URL, CONFIG.BASE_TTL);
    source = "bundled snapshot";
    online = false;
  }
  const matches = (raw.matches || []).map(normalizeMatch);
  return { matches, source, online, fetchedAt: new Date() };
}

// Try the live API and overlay it; never throws.
export async function applyLive(matches) {
  try {
    const url = CONFIG.LIVE_API_BASE + CONFIG.LIVE_GAMES_PATH;
    const liveRaw = await cachedFetch(url, CONFIG.LIVE_TTL);
    const { applied } = applyLiveOverlay(matches, liveRaw);
    return { ok: true, applied };
  } catch (_) {
    return { ok: false, applied: 0 };
  }
}
