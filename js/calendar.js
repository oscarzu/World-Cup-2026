// calendar.js — build a downloadable .ics with the knockout-stage fixtures.
// Team names are resolved from today's standings/results at generation time
// (a downloaded file is a static snapshot — see the README/UI note about a
// subscribable feed for auto-updating teams).

import { VENUES } from "./config.js";
import { kickoffDate } from "./api.js";

const KO_ROUNDS = ["Round of 32", "Round of 16", "Quarter-final", "Semi-final", "Match for third place", "Final"];

const pad = (n) => String(n).padStart(2, "0");
const icsDate = (d) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const esc = (s) => String(s ?? "").replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");

// Resolve a slot code to a readable team using current standings (projection).
function readableSlot(code, standings) {
  let m = /^([12])([A-L])$/.exec(code);
  if (m) {
    const rows = standings.get("Group " + m[2]);
    const r = rows && rows[Number(m[1]) - 1];
    return r && r.P > 0 ? r.name : `${m[1] === "1" ? "1st" : "2nd"} Group ${m[2]}`;
  }
  if (/^3/.test(code)) return `Best 3rd (${code.slice(1)})`;
  m = /^W(\d+)$/.exec(code);
  if (m) return `Winner #${m[1]}`;
  return code;
}

export function buildKnockoutICS(matches, standings = new Map()) {
  const stamp = "20260101T000000Z";
  const events = [];
  for (const mt of matches) {
    if (!KO_ROUNDS.includes(mt.round)) continue;
    const ko = kickoffDate(mt);
    if (!ko) continue;
    const end = new Date(ko.getTime() + 2 * 60 * 60 * 1000);
    const v = VENUES[mt.ground];
    const loc = v ? `${v.fifa}, ${v.city}` : (mt.ground || "");
    const home = readableSlot(mt.home.name, standings);
    const away = readableSlot(mt.away.name, standings);
    const title = `WC 2026 · ${mt.round}: ${home} vs ${away}`;
    events.push([
      "BEGIN:VEVENT",
      `UID:wc2026-ko-${mt.num || mt.id}@oscarzu.github.io`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(ko)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${esc(title)}`,
      `LOCATION:${esc(loc)}`,
      `DESCRIPTION:${esc("Copa Mundial de la FIFA 2026 · equipos según la clasificación al momento de exportar.")}`,
      "END:VEVENT",
    ].join("\r\n"));
  }
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//World Cup 2026 Dashboard//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:World Cup 2026 — Knockouts",
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
