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

// Editorial "must-watch" hooks, keyed by ISO so every name variant maps. One
// evocative clause per team, written like a sports columnist selling the
// ticket. [es, en]. Kept in sync with the Worker feed.
const HOOK = {
  ar: ["los campeones del mundo defienden su corona y exprimen la era Messi", "the reigning world champions defend their crown in Messi's twilight"],
  br: ["la Canarinha persigue la sexta estrella que se le niega desde 2002", "the Seleção chase the sixth star denied them since 2002"],
  fr: ["la Francia de Mbappé golea y da miedo", "Mbappé's France score for fun and terrify defenses"],
  es: ["la Roja del toque infinito y la chispa de Lamine Yamal", "Spain's endless tiki-taka and Lamine Yamal's spark"],
  "gb-eng": ["Inglaterra carga con 60 años de espera y un plantel para romperla", "England carry a 60-year wait and a squad to end it"],
  "gb-sct": ["Escocia, corazón y orgullo, viene a incomodar a los grandes", "Scotland bring heart and pride to upset the big names"],
  pt: ["puede ser el último baile mundialista de Cristiano Ronaldo", "this may be Cristiano Ronaldo's last World Cup dance"],
  de: ["la Alemania tetracampeona quiere reconstruir su imperio", "four-time champions Germany want to rebuild their empire"],
  nl: ["la Naranja Mecánica busca por fin la copa que tres finales le negaron", "the Oranje hunt the cup three finals denied them"],
  mx: ["el Tri sueña en casa con romper por fin el maleficio del quinto partido", "host Mexico dream of finally breaking their last-16 curse"],
  us: ["los anfitriones quieren encender al país y volverlo loco por el futbol", "the hosts want to set the country alight for soccer"],
  ca: ["Canadá, la sorpresa anfitriona, llega sin nada que perder", "co-hosts Canada arrive with nothing to lose"],
  hr: ["la Croacia de Modrić, eterna sorpresa que nunca muere", "Modrić's Croatia, the dark horse that never dies"],
  uy: ["la garra charrúa, dos veces campeona, jamás se rinde", "Uruguay's two-time champions and never-say-die garra"],
  ma: ["Marruecos, los héroes de 2022, ya no sorprenden a nadie", "2022 semifinalists Morocco surprise nobody anymore"],
  be: ["la generación dorada belga dispara su última bala", "Belgium's golden generation fire their final shot"],
  jp: ["Japón, el gigante asiático que ya tumbó a Alemania y España", "Japan, the Asian giant that toppled Germany and Spain"],
  co: ["Colombia baila, ataca y enamora al neutral", "Colombia dance, attack and win over the neutral"],
  sn: ["los Leones de Teranga, campeones de África, rugen fuerte", "the Lions of Teranga, African champions, roar loud"],
  ch: ["Suiza, rocosa y siempre incómoda en los cruces", "rock-solid Switzerland, forever awkward in knockouts"],
  no: ["la Noruega de Haaland es pura dinamita", "Haaland's Norway are pure dynamite"],
  za: ["Sudáfrica, los Bafana Bafana, vuelven a ilusionar a un continente", "South Africa's Bafana Bafana rekindle a continent's hope"],
  ec: ["Ecuador, joven y atrevido, no le tiembla la mano", "Ecuador, young and fearless, never blink"],
  au: ["los Socceroos australianos venden cara su piel", "Australia's Socceroos sell their skin dearly"],
  kr: ["Corea del Sur corre los 90 minutos como si fueran el último", "South Korea run every minute like it's their last"],
};
// Sorted ISO pair → a marquee-rivalry line that trumps the per-team hooks.
const RIVAL = {
  "ar|br": ["el clásico sudamericano que paraliza a un continente entero", "the South American superclásico that stops a whole continent"],
  "mx|us": ["el pleito de toda la vida: México vs USA, la frontera arde", "the oldest of grudges: Mexico vs USA, the border on fire"],
  "de|nl": ["odio histórico sobre el césped: Alemania vs Países Bajos", "pure historic needle: Germany vs the Netherlands"],
  "ar|gb-eng": ["la herida abierta del 86 vuelve: Argentina vs Inglaterra", "the open wound of '86 reopens: Argentina vs England"],
  "es|pt": ["vecinos ibéricos que no se perdonan nada", "Iberian neighbors who give each other no quarter"],
  "br|fr": ["revancha de altura: Brasil vs Francia, fútbol de otra galaxia", "a heavyweight rematch: Brazil vs France, football from another galaxy"],
};
// Build the editorial line from two resolved team NAMES (not slot codes).
function highlight(homeName, awayName, lang) {
  const L = lang === "es" ? 0 : 1;
  const hIso = FLAGS[homeName], aIso = FLAGS[awayName];
  if (!hIso || !aIso) return null; // a slot is still a placeholder → skip
  const key = [hIso, aIso].sort().join("|");
  if (RIVAL[key]) return RIVAL[key][L];
  const disp = (n) => (lang === "es" ? teamES(n) : n);
  const fb = (n) => (lang === "es" ? `${disp(n)} quiere dar la campanada` : `${n} are out to cause a shock`);
  const h = HOOK[hIso] ? HOOK[hIso][L] : fb(homeName);
  const a = HOOK[aIso] ? HOOK[aIso][L] : fb(awayName);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  return `${cap(h)} — ${a}.`;
}

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
    const homeName = readableSlot(mt.home.name, standings, lang);
    const awayName = readableSlot(mt.away.name, standings, lang);
    const home = label(mt.home.name, standings, lang);
    const away = label(mt.away.name, standings, lang);
    const info = ROUND_INFO[mt.round] || [["Eliminatoria", "Knockout"], ["el avance", "advancing"]];
    const roundLabel = info[0][es ? 0 : 1];
    const stake = info[1][es ? 0 : 1];
    const hl = highlight(homeName, awayName, lang);
    // Final score for already-played matches (past events show the result).
    const sh = mt.score?.home, sa = mt.score?.away, played = mt.status === "finished" && sh != null;
    const pen = mt.score?.penHome != null ? ` (pen ${mt.score.penHome}-${mt.score.penAway})` : "";
    const matchup = played ? `${home} ${sh}-${sa} ${away}` : `${home} vs ${away}`;

    const desc = [
      ...(played ? [es ? `✅ Final: ${homeName} ${sh}-${sa} ${awayName}${pen}` : `✅ Full-time: ${homeName} ${sh}-${sa} ${awayName}${pen}`] : []),
      `🏟️ ${loc}`,
      BROADCAST[lang],
      ...(hl && !played ? [`⚡ ${hl}`] : []),
      ...(played ? [] : [es ? `⭐ Se juega ${stake}.` : `⭐ Playing for ${stake}.`]),
      es ? "🔄 Equipos según la clasificación al momento de exportar; suscríbete al feed para que se actualicen al avanzar."
        : "🔄 Teams reflect the standings at export time; subscribe to the feed for auto-updating teams.",
    ].join("\n");

    events.push([
      "BEGIN:VEVENT",
      `UID:wc2026-ko-${mt.num || mt.id}@oscarzu.github.io`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(ko)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${esc(`${matchup} · ${roundLabel}`)}`,
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
