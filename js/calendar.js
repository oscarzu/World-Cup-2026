// calendar.js — build a downloadable .ics with the knockout-stage fixtures.
// Team names are resolved from today's standings/results at generation time
// (a downloaded file is a static snapshot — see the README/UI note about a
// subscribable feed for auto-updating teams). The file is localized to the
// selected UI language and enriched with flags, venue and broadcasters so it
// matches the auto-updating Worker feed.

import { VENUES, FLAGS, teamES } from "./config.js";
import { kickoffDate } from "./api.js";

const KO_ROUNDS = ["Round of 32", "Round of 16", "Quarter-final", "Semi-final", "Match for third place", "Final"];

// round name → [es, en] label + [es, en] "what's at stake".
const ROUND_INFO = {
  "Round of 32": [["Dieciseisavos", "Round of 32"], ["el pase a Octavos", "a spot in the Round of 16"]],
  "Round of 16": [["Octavos de final", "Round of 16"], ["el pase a Cuartos", "a spot in the quarter-finals"]],
  "Quarter-final": [["Cuartos de final", "Quarter-final"], ["el pase a Semifinales", "a spot in the semi-finals"]],
  "Semi-final": [["Semifinal", "Semi-final"], ["el pase a la Final", "a spot in the final"]],
  "Match for third place": [["Tercer lugar", "Third place"], ["el bronce", "the bronze medal"]],
  Final: [["Final", "Final"], ["el título mundial", "the world title"]],
};
const BROADCAST = {
  es: "📺 México: Televisa (Canal 5 · TUDN · VIX) y TV Azteca (Azteca 7 · Azteca Deportes)",
  en: "📺 USA: FOX & FS1 (FOX Sports app / FOX One) — Spanish: Telemundo / Peacock",
};

const pad = (n) => String(n).padStart(2, "0");
const icsDate = (d) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const esc = (s) => String(s ?? "").replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");

// ISO flag code → emoji (handles the England/Scotland tag sequences).
function flagEmoji(iso) {
  if (!iso) return "";
  if (iso === "gb-eng") return "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
  if (iso === "gb-sct") return "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
  return iso.slice(0, 2).toUpperCase().replace(/./g, (c) => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0)));
}

// Resolve a slot code to a readable team using current standings (projection).
function readableSlot(code, standings, lang) {
  const es = lang === "es";
  let m = /^([12])([A-L])$/.exec(code);
  if (m) {
    const rows = standings.get("Group " + m[2]);
    const r = rows && rows[Number(m[1]) - 1];
    if (r && r.P > 0) return r.name;
    return es
      ? `${m[1]}.º Grupo ${m[2]}`
      : `${m[1] === "1" ? "1st" : "2nd"} Group ${m[2]}`;
  }
  if (/^3/.test(code)) return es ? `Mejor 3.º (${code.slice(1)})` : `Best 3rd (${code.slice(1)})`;
  m = /^W(\d+)$/.exec(code);
  if (m) return es ? `Ganador #${m[1]}` : `Winner #${m[1]}`;
  return code;
}

// Real team name → "🇧🇷 Brasil"; placeholders stay plain (no flag).
function label(code, standings, lang) {
  const name = readableSlot(code, standings, lang);
  const flag = FLAGS[name] ? flagEmoji(FLAGS[name]) : "";
  const display = lang === "es" ? teamES(name) : name;
  return flag ? `${flag} ${display}` : display;
}

export function buildKnockoutICS(matches, standings = new Map(), lang = "es") {
  const es = lang === "es";
  const stamp = "20260101T000000Z";
  const events = [];
  for (const mt of matches) {
    if (!KO_ROUNDS.includes(mt.round)) continue;
    const ko = kickoffDate(mt);
    if (!ko) continue;
    const end = new Date(ko.getTime() + 2 * 60 * 60 * 1000);
    const v = VENUES[mt.ground];
    const loc = v ? `${v.fifa}, ${v.city}` : (mt.ground || "");
    const home = label(mt.home.name, standings, lang);
    const away = label(mt.away.name, standings, lang);
    const info = ROUND_INFO[mt.round] || [["Eliminatoria", "Knockout"], ["el avance", "advancing"]];
    const roundLabel = info[0][es ? 0 : 1];
    const stake = info[1][es ? 0 : 1];

    const desc = [
      `🏟️ ${loc}`,
      BROADCAST[lang],
      es ? `⭐ ${home} vs ${away} — se juega ${stake}.`
        : `⭐ ${home} vs ${away} — playing for ${stake}.`,
      es ? "🔄 Equipos según la clasificación al momento de exportar; suscríbete al feed para que se actualicen al avanzar."
        : "🔄 Teams reflect the standings at export time; subscribe to the feed for auto-updating teams.",
    ].join("\n");

    events.push([
      "BEGIN:VEVENT",
      `UID:wc2026-ko-${mt.num || mt.id}@oscarzu.github.io`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(ko)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${esc(`${home} vs ${away} · ${roundLabel}`)}`,
      `LOCATION:${esc(loc)}`,
      `DESCRIPTION:${esc(desc)}`,
      "END:VEVENT",
    ].join("\r\n"));
  }
  const calName = es ? "Mundial 2026 — Eliminatorias" : "World Cup 2026 — Knockouts";
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//World Cup 2026 Dashboard//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(calName)}`,
    ...events, "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadICS(text, filename = "world-cup-2026-knockouts.ics") {
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
