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
        liveNow: (snap.live || []).length,
        snapshotUpdatedAt: snap.updatedAt || null,
        hasCalendar: !!(await env.WC26.get("calendar:es")), lastResult }, 200, cors);
    }
    if (path === "/calendar.ics") {
      const lang = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "es";
      const key = "calendar:" + lang;
      let ics = await env.WC26.get(key);
      if (!ics) { await collect(env); ics = await env.WC26.get(key); } // build on first hit
      return new Response(ics || "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR", {
        status: 200,
        headers: { ...cors, "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=300" },
      });
    }
    if (path === "/refresh") { const r = await collect(env); return json(r, 200, cors); }
    // Audit/rebuild: backfill every played match (chunked). ?reset=1 starts fresh.
    if (path === "/rebuild") {
      const reset = new URL(request.url).searchParams.get("reset") === "1";
      const r = await collect(env, { reset, backfillLimit: 40 });
      return json(r, 200, cors);
    }

    return json({ error: "not found", routes: ["/snapshot", "/teamstats", "/health", "/calendar.ics", "/refresh", "/rebuild"] }, 404, cors);
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
    const aggBefore = JSON.stringify(agg.fixtures); // for change-detection (KV put budget)
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

    result.captured = Object.keys(agg.fixtures).length;
    const yellowCards = aggregateCards(agg);
    result.yellowCards = yellowCards.length;

    // ---- write to KV ONLY when content changed (free tier = 1000 puts/day) ----
    // Compare meaningful content (ignore timestamps). When no match is live and
    // nothing was captured, this writes nothing, so idle hours cost 0 puts.
    let wrote = 0;
    const prevSnap = JSON.parse((await env.WC26.get("snapshot")) || "null");
    // Key the write on the ESSENTIALS only (score, goals, status) — not the
    // clock or live stat ticks — so a goal triggers a write but routine ticking
    // doesn't. Keeps idle/quiet periods at 0 puts (free tier = 1000/day).
    const essence = (arr) => (arr || []).map((m) => ({ id: m.id, s: m.score, g: m.goals, st: m.status }));
    const snapContent = JSON.stringify({ live: essence(live), yc: yellowCards.length });
    const prevContent = prevSnap ? JSON.stringify({ live: essence(prevSnap.live), yc: (prevSnap.yellowCards || []).length }) : "";
    if (snapContent !== prevContent) {
      await env.WC26.put("snapshot", JSON.stringify({ updatedAt: Date.now(), live, yellowCards }));
      wrote++;
    }
    if (JSON.stringify(agg.fixtures) !== aggBefore) {
      agg.updatedAt = Date.now();
      await env.WC26.put("agg", JSON.stringify(agg));
      wrote++;
    }
    // Knockout calendar: rebuild from ESPN in both languages, store only when it
    // actually changed (real teams replacing TBD as the bracket advances).
    const koStart = env.WC_KO_START || "2026-06-28";
    const teamGoals = aggregateTeams(agg);
    for (const lang of ["es", "en"]) {
      const ics = buildICS(events, koStart, lang, teamGoals);
      const key = "calendar:" + lang;
      if (ics !== (await env.WC26.get(key))) { await env.WC26.put(key, ics); wrote++; }
    }
    result.wrote = wrote;
    result.ok = true;
  } catch (e) {
    result.error = String(e && e.message ? e.message : e);
  } finally {
    result.calls = calls;
    // Record lastResult only when a write happened or on error — never on quiet
    // idle runs (keeps KV puts minimal).
    if (result.wrote > 0 || result.error) {
      await env.WC26.put("lastResult", JSON.stringify({ ...result, at: Date.now() }));
    }
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

// ---- auto-updating knockout calendar (.ics) ----
// Built from the live ESPN scoreboard, so real teams replace "TBD" as the
// bracket advances. Anything on/after WC_KO_START (R32) is treated as knockout.
function icsZ(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}00Z`;
}
function icsEsc(s) { return String(s ?? "").replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n"); }

// ESPN team name → Spanish name + ISO flag code (for emoji flags in the .ics).
const TEAM = {
  "South Africa": ["Sudáfrica", "za"], Canada: ["Canadá", "ca"], Germany: ["Alemania", "de"],
  Sweden: ["Suecia", "se"], Netherlands: ["Países Bajos", "nl"], Morocco: ["Marruecos", "ma"],
  Brazil: ["Brasil", "br"], Japan: ["Japón", "jp"], "Ivory Coast": ["Costa de Marfil", "ci"],
  "Cote d'Ivoire": ["Costa de Marfil", "ci"], Mexico: ["México", "mx"], USA: ["Estados Unidos", "us"],
  "United States": ["Estados Unidos", "us"], Switzerland: ["Suiza", "ch"], Australia: ["Australia", "au"],
  Argentina: ["Argentina", "ar"], France: ["Francia", "fr"], Spain: ["España", "es"], Portugal: ["Portugal", "pt"],
  England: ["Inglaterra", "gb-eng"], Croatia: ["Croacia", "hr"], Uruguay: ["Uruguay", "uy"], Colombia: ["Colombia", "co"],
  Belgium: ["Bélgica", "be"], Senegal: ["Senegal", "sn"], Norway: ["Noruega", "no"], Egypt: ["Egipto", "eg"],
  Ecuador: ["Ecuador", "ec"], "South Korea": ["Corea del Sur", "kr"], "Korea Republic": ["Corea del Sur", "kr"],
  Iran: ["Irán", "ir"], "IR Iran": ["Irán", "ir"], Austria: ["Austria", "at"], Scotland: ["Escocia", "gb-sct"],
  Paraguay: ["Paraguay", "py"], Panama: ["Panamá", "pa"], Ghana: ["Ghana", "gh"], "Cape Verde": ["Cabo Verde", "cv"],
  "Cabo Verde": ["Cabo Verde", "cv"], Algeria: ["Argelia", "dz"], Tunisia: ["Túnez", "tn"], Qatar: ["Catar", "qa"],
  "Saudi Arabia": ["Arabia Saudita", "sa"], Jordan: ["Jordania", "jo"], Iraq: ["Irak", "iq"], Uzbekistan: ["Uzbekistán", "uz"],
  "DR Congo": ["RD Congo", "cd"], "New Zealand": ["Nueva Zelanda", "nz"], Haiti: ["Haití", "ht"], "Curacao": ["Curazao", "cw"],
  "Curaçao": ["Curazao", "cw"], "Bosnia & Herzegovina": ["Bosnia y Herzegovina", "ba"], "Czech Republic": ["República Checa", "cz"],
  Czechia: ["República Checa", "cz"], Turkey: ["Turquía", "tr"], Turkiye: ["Turquía", "tr"], "Türkiye": ["Turquía", "tr"],
};
function flagEmoji(iso) {
  if (!iso) return "";
  if (iso === "gb-eng") return "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
  if (iso === "gb-sct") return "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
  return iso.slice(0, 2).toUpperCase().replace(/./g, (c) => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0)));
}
// round headline → [es, en] label + [es, en] "what's at stake".
const ROUNDS = [
  [/round of 32|1\/16/i, ["Dieciseisavos", "Round of 32"], ["el pase a Octavos", "a spot in the Round of 16"]],
  [/round of 16|1\/8/i, ["Octavos de final", "Round of 16"], ["el pase a Cuartos", "a spot in the quarter-finals"]],
  [/quarter/i, ["Cuartos de final", "Quarter-final"], ["el pase a Semifinales", "a spot in the semi-finals"]],
  [/semi/i, ["Semifinal", "Semi-final"], ["el pase a la Final", "a spot in the final"]],
  [/third|3rd/i, ["Tercer lugar", "Third place"], ["el bronce", "the bronze medal"]],
  [/final/i, ["Final", "Final"], ["el título mundial", "the world title"]],
];
function roundInfo(headline) {
  for (const [re, label, stake] of ROUNDS) if (re.test(headline || "")) return { label, stake };
  return { label: ["Eliminatoria", "Knockout"], stake: ["el avance", "advancing"] };
}
const BROADCAST = {
  es: "📺 México: Televisa (Canal 5 · TUDN · VIX) y TV Azteca (Azteca 7 · Azteca Deportes)",
  en: "📺 USA: FOX & FS1 (FOX Sports app / FOX One) — Spanish: Telemundo / Peacock",
};

function buildICS(events, koStart, lang, teamGoals) {
  const L = lang === "es" ? 0 : 1;
  const tName = (n) => (L === 0 && TEAM[n] ? TEAM[n][0] : n);
  const tFlag = (n) => (TEAM[n] ? flagEmoji(TEAM[n][1]) : "");
  const TBD = lang === "es" ? "Por definir" : "TBD";
  // Fixed stamp so the .ics only changes when the FIXTURES change.
  const stamp = "20260101T000000Z";
  const calName = lang === "es" ? "Mundial 2026 — Eliminatorias" : "World Cup 2026 — Knockouts";
  const out = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//World Cup 2026//Worker//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsEsc(calName)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT3H", "X-PUBLISHED-TTL:PT3H",
  ];
  for (const ev of events || []) {
    const date = (ev.date || "");
    if (date.slice(0, 10) < koStart) continue;
    const start = new Date(ev.date);
    if (isNaN(start)) continue;
    const comp = ev.competitions?.[0] || {};
    const cs = comp.competitors || [];
    const home = cs.find((c) => c.homeAway === "home") || cs[0] || {};
    const away = cs.find((c) => c.homeAway === "away") || cs[1] || {};
    const hRaw = home.team?.displayName || "", aRaw = away.team?.displayName || "";
    const hn = hRaw ? `${tFlag(hRaw)} ${tName(hRaw)}`.trim() : TBD;
    const an = aRaw ? `${tFlag(aRaw)} ${tName(aRaw)}`.trim() : TBD;
    const { label, stake } = roundInfo(comp.notes?.[0]?.headline || ev.season?.slug);
    const venue = comp.venue?.fullName || "";
    const city = comp.venue?.address?.city || "";
    const gH = teamGoals?.[hRaw]?.goals, gA = teamGoals?.[aRaw]?.goals;
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

    const lines = [];
    lines.push(`🏟️ ${venue}${city ? `, ${city}` : ""}`);
    lines.push(BROADCAST[lang === "es" ? "es" : "en"]);
    lines.push(lang === "es"
      ? `⭐ ${hn} vs ${an} — se juega ${stake[0]}.`
      : `⭐ ${hn} vs ${an} — playing for ${stake[1]}.`);
    if (gH != null && gA != null) {
      lines.push(lang === "es"
        ? `⚽ Goleo en el torneo: ${tName(hRaw)} ${gH} · ${tName(aRaw)} ${gA}.`
        : `⚽ Tournament goals: ${hRaw} ${gH} · ${aRaw} ${gA}.`);
    }
    lines.push(lang === "es"
      ? "🔄 Equipos según el cuadro actual; se actualizan al avanzar la fase."
      : "🔄 Teams reflect the current bracket; they update as the round advances.");

    out.push(
      "BEGIN:VEVENT",
      `UID:wc2026-espn-${ev.id}@wc26-football-proxy`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsZ(start)}`,
      `DTEND:${icsZ(end)}`,
      `SUMMARY:${icsEsc(`${hn} vs ${an} · ${label[L]}`)}`,
      `LOCATION:${icsEsc(`${venue}${city ? `, ${city}` : ""}`)}`,
      `DESCRIPTION:${icsEsc(lines.join("\n"))}`,
      "END:VEVENT",
    );
  }
  out.push("END:VCALENDAR");
  return out.join("\r\n");
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } });
}
function raw(body, cors) {
  return new Response(body, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } });
}
