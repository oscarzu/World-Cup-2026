// i18n.js — lightweight ES/EN switch.
//   t(key)        → translated UI string (falls back to ES, then the key)
//   tName(team)   → selección name in the active language (EN = original)
//   applyStatic() → fills every [data-i18n] / [data-i18n-html] element
//   getLang/setLang persist the choice in localStorage.

import { teamES } from "./config.js";

const STORE = "wc26:lang";

// Default language by the viewer's locale/region, per Web Interface Guidelines
// (detect via navigator.languages / timezone, never IP). Spanish only when the
// viewer appears to be in Mexico; English everywhere else. A manual choice
// (saved below) always wins on later visits.
const MX_TIMEZONES = /America\/(Mexico_City|Cancun|Merida|Monterrey|Matamoros|Chihuahua|Ciudad_Juarez|Ojinaga|Mazatlan|Bahia_Banderas|Hermosillo|Tijuana)/i;
function detectLang() {
  try {
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || "";
    if (MX_TIMEZONES.test(tz)) return "es";          // physically in Mexico
    const langs = (typeof navigator !== "undefined" && (navigator.languages || [navigator.language])) || [];
    if (langs.some((l) => /-MX\b/i.test(l || ""))) return "es"; // es-MX locale
    return "en";                                      // outside Mexico → English
  } catch (_) { return "es"; }
}
let lang = (localStorage.getItem(STORE) || detectLang());

export function getLang() { return lang; }
export function setLang(l) { lang = l === "en" ? "en" : "es"; localStorage.setItem(STORE, lang); }

// Each entry: [es, en].
const STR = {
  // header / nav
  "brand.sub": ["Canadá · México · USA", "Canada · Mexico · USA"],
  "hdr.live": ["EN VIVO", "LIVE"],
  "tab.overview": ["Resumen", "Overview"],
  "tab.stats": ["Estadísticas", "Stats"],
  "tab.live": ["En vivo", "Live"],
  "tab.matches": ["Partidos", "Matches"],
  "tab.standings": ["Grupos", "Groups"],
  "tab.bracket": ["Eliminatorias", "Knockouts"],
  "tab.scorers": ["Goleadores", "Scorers"],
  "tab.venues": ["Sedes", "Venues"],

  // hero
  "hero.title": ["La 23.ª Copa Mundial de la FIFA", "The 23rd FIFA World Cup"],
  "hero.text": ["Primera edición con <strong>48 selecciones</strong>, repartida en tres países anfitriones y <strong>16 sedes</strong>.",
                "The first edition with <strong>48 teams</strong>, across three host nations and <strong>16 venues</strong>."],
  "host.cst": ["Horarios en CST", "Times in CST"],

  // generic section heads / cards
  "ov.next": ["Próximos y en vivo", "Live & upcoming"],
  "ov.goalsByMd": ["Goles por jornada", "Goals by matchday"],
  "foot.goalsByMd": ["Goles anotados en cada jornada", "Goals scored each matchday"],
  "rules.kicker": ["Reglamento", "Rules"],
  "rules.title": ["Reglas esenciales de esta Copa", "Key rules of this World Cup"],
  "rules.sub": ["Lo nuevo que debes saber para el Mundial 2026.", "What's new to know for the 2026 World Cup."],

  "stats.kicker": ["Panorama", "Overview"],
  "stats.title": ["El Mundial 2026, contado con datos", "The 2026 World Cup, told with data"],
  "stats.sub": ["Lo más relevante de lo que va de la Copa, de un vistazo.", "The story so far, at a glance."],
  "kpis.kicker": ["KPIs", "KPIs"],
  "kpis.title": ["El torneo en cifras", "The tournament in numbers"],
  "cur.kicker": ["Curiosidades", "Fun facts"],
  "cur.title": ["Datos curiosos del torneo", "Fun facts of the tournament"],
  "cur.sub": ["Hallazgos extraídos de los partidos disputados.", "Findings from the matches played so far."],
  "agg.kicker": ["Agregados", "Aggregates"],
  "agg.title": ["Fueras de lugar, VAR, tarjetas y más", "Offsides, VAR, cards and more"],
  "agg.sub": ["Totales del torneo que no se ven en el marcador.", "Tournament totals beyond the scoreboard."],
  "viz.kicker": ["Visualizaciones", "Charts"],
  "viz.title": ["Dónde se deciden los partidos", "Where matches are decided"],
  "viz.sub": ["Goleo, ataque y los momentos que marcan el torneo.", "Scoring, attack and the tournament's defining moments."],

  "disc.kicker": ["Disciplina y eficacia", "Discipline & efficiency"],
  "disc.title": ["Quién pega, quién falla el arco", "Who fouls, who misses the target"],
  "disc.sub": ["Faltas por partido, tarjetas y puntería. Con proveedor en vivo los datos son reales (ESPN); sin él, se muestran valores estimados.",
               "Fouls per match, cards and finishing. With a live provider the data is real (ESPN); otherwise estimated values are shown."],
  "eff.kicker": ["Eficacia de cara al arco", "Finishing efficiency"],
  "eff.title": ["Puntería: % de conversión", "Finishing: conversion %"],
  "eff.sub": ["<strong>% de conversión = goles ÷ tiros a puerta.</strong> Mayor % = más eficaz.",
              "<strong>Conversion % = goals ÷ shots on target.</strong> Higher % = more efficient."],
  "eff.best": ["Más eficaces", "Most efficient"],
  "eff.bestTitle": ["Top 10 mayor eficacia", "Top 10 — highest conversion"],
  "eff.worst": ["Menos eficaces", "Least efficient"],
  "eff.worstTitle": ["Top 10 menor eficacia", "Top 10 — lowest conversion"],
  "eff.footBest": ["Mayor % de conversión = mejor", "Higher conversion % = better"],
  "eff.footWorst": ["Menor % de conversión = falla más el arco", "Lower conversion % = misses more"],
  "eff.histKicker": ["Histórico · fase de grupos", "History · group stage"],
  "eff.histTitle": ["Más eficaz vs. menos eficaz — por jornada", "Most vs. least efficient — by matchday"],
  "eff.cumTitle": ["Más eficaz vs. menos eficaz — acumulado", "Most vs. least efficient — cumulative"],
  "eff.histFoot": ["Solo fase de grupos (J1–J3): todas con los mismos partidos · ilustrativo",
                   "Group stage only (MD1–MD3): equal games for all · illustrative"],
  "eff.seriesBest": ["Más eficaz", "Most efficient"],
  "eff.seriesWorst": ["Menos eficaz", "Least efficient"],

  "rc.kicker": ["Tarjetas rojas y lesiones", "Red cards & injuries"],
  "rc.title": ["Lo más duro del torneo", "The tournament's toughest moments"],
  "rc.sub": ["Expulsiones por selección y lesiones de gravedad.", "Sendings-off by team and serious injuries."],
  "rc.byTeam": ["Tarjetas rojas por selección", "Red cards by team"],
  "rc.foot": ["Expulsiones · reales con ESPN en vivo, estimadas sin proveedor", "Sendings-off · real with live ESPN, estimated otherwise"],
  "rc.injFoot": ["Datos ilustrativos (no hay un feed fiable de lesiones)", "Illustrative data (no reliable injuries feed)"],
  "rc.total": ["Tarjetas rojas", "Red cards"],
  "rc.injuries": ["Lesiones graves", "Serious injuries"],
  "rc.injuriesCap": ["bajas de consideración en el torneo", "notable injuries in the tournament"],
  "rc.injList": ["Bajas destacadas", "Notable absentees"],

  "foulsRank.kicker": ["Ranking", "Ranking"],
  "foulsRank.title": ["Top 10 selecciones con más faltas por partido", "Top 10 teams by fouls per match"],
  "foulsChart.title": ["Selecciones con más faltas (por partido)", "Teams with most fouls (per match)"],
  "foulsChart.foot": ["Promedio de faltas por partido", "Average fouls per match"],
  "cardsChart.title": ["Jugadores con más amarillas", "Players with most yellow cards"],
  "cardsChart.foot": ["Top 10 jugadores", "Top 10 players"],
  "groupsChart.title": ["Goles por grupo", "Goals by group"],
  "groupsChart.foot": ["Goles por grupo", "Goals by group"],
  "teamsChart.title": ["Selecciones más goleadoras", "Top-scoring teams"],
  "teamsChart.foot": ["Top 8 por goles anotados", "Top 8 by goals scored"],
  "momentsChart.title": ["Momentos del torneo", "Tournament moments"],
  "momentsChart.foot": ["Conteo de partidos memorables", "Memorable match counts"],

  // live
  "live.socialK": ["Social", "Social"],
  "live.socialT": ["Redes en vivo", "Live on social"],
  "live.socialS": ["Cobertura oficial del torneo en X e Instagram.", "Official tournament coverage on X and Instagram."],
  "live.none": ["No hay partidos en vivo ahora", "No live matches right now"],
  "live.noneSub": ["En cuanto ruede el balón, el marcador y los goles aparecerán aquí en tiempo real.",
                   "As soon as a match kicks off, scores and goals will appear here in real time."],
  "live.next": ["Próximos partidos", "Upcoming matches"],
  "live.everyPre": ["se actualiza cada", "updates every"],
  "live.source": ["Fuente", "Source"],
  "live.updated": ["Actualizado", "Updated"],
  "live.srcOn": ["ESPN (en vivo)", "ESPN (live)"],
  "live.srcOff": ["datos del torneo (sin proveedor)", "tournament data (no live provider)"],
  "empty.noUpcoming": ["No hay partidos próximos en la programación.", "No upcoming matches scheduled."],
  "empty.noResults": ["Sin resultados.", "No results."],
  "empty.noPlayed": ["Aún sin partidos jugados.", "No matches played yet."],
  "empty.noGoals": ["Aún no hay goles registrados.", "No goals recorded yet."],

  // matches / standings / bracket
  "matches.search": ["Buscar selección…", "Search team…"],
  "matches.allRounds": ["Todas las fases", "All rounds"],
  "st.team": ["Equipo", "Team"],
  "badge.live": ["En vivo", "Live"],
  "badge.ft": ["Final", "Full-time"],
  "badge.up": ["Próximo", "Upcoming"],
  "tbd": ["Por definir", "TBD"],

  // footer
  "credit": ["En vivo y estadísticas: ESPN · Calendario base: openfootball (dominio público) · Banderas: flagcdn.com · Visualización con Chart.js.",
             "Live & stats: ESPN · Base fixtures: openfootball (public domain) · Flags: flagcdn.com · Charts by Chart.js."],
  "credit.dim": ["Autor: Zuriel Santibañez", "Author: Zuriel Santibañez"],

  // units / common words used in dynamic strings
  "u.goals": ["goles", "goals"],
  "u.fouls": ["faltas", "fouls"],
  "u.shots": ["tiros", "shots"],
  "u.matches": ["partidos", "matches"],
  "u.cards": ["amarillas", "yellows"],
  "u.venues": ["sedes", "venues"],
  "arch.none": ["Aún no hay jornadas disputadas.", "No matchdays played yet."],
  "arch.empty": ["Sin publicaciones guardadas para esta jornada — explora por estadio ↑",
                 "No saved posts for this matchday — explore by stadium ↑"],

  // loading / error / offline / search feedback
  "load.loading": ["Cargando datos del torneo…", "Loading tournament data…"],
  "err.title": ["No pudimos cargar los datos", "We couldn't load the data"],
  "err.body": ["Hubo un problema al conectar con la fuente. Revisa tu conexión e inténtalo de nuevo.",
               "Something went wrong reaching the source. Check your connection and try again."],
  "err.retry": ["Reintentar", "Retry"],
  "offline.msg": ["Mostrando datos guardados — sin conexión.", "Showing saved data — you're offline."],
  "offline.close": ["Cerrar aviso", "Dismiss"],
  "search.one": ["resultado", "result"],
  "search.many": ["resultados", "results"],
  "search.none": ["Sin resultados para", "No results for"],
  "search.clear": ["Limpiar", "Clear"],

  // overview KPIs
  "kpi.teams": ["Selecciones", "Teams"], "kpi.groups": ["Grupos", "Groups"],
  "kpi.matches": ["Partidos", "Matches"], "kpi.venues": ["Sedes", "Venues"],
  "kpi.goals": ["Goles", "Goals"], "kpi.gpm": ["Goles/partido", "Goals/match"],
  // stats KPIs
  "s.played": ["Partidos jugados", "Matches played"], "s.goalsTotal": ["Goles totales", "Total goals"],
  "s.avg": ["Promedio de goles", "Average goals"], "s.live": ["En vivo ahora", "Live now"],
  "s.finished": ["Finalizados", "Finished"], "s.remaining": ["Restantes", "Remaining"],
  // aggregates
  "a.offsides": ["Fueras de lugar", "Offsides"], "a.disallowed": ["Goles anulados", "Disallowed goals"],
  "a.restored": ["Goles desanulados por VAR", "Goals restored by VAR"],
  "a.var": ["Revisiones VAR", "VAR reviews"], "a.pens": ["Penales señalados", "Penalties awarded"],
  "a.yellow": ["Tarjetas amarillas", "Yellow cards"], "a.red": ["Tarjetas rojas", "Red cards"],
  "a.fouls": ["Faltas cometidas", "Fouls committed"], "a.corners": ["Tiros de esquina", "Corners"],
  "a.saves": ["Atajadas", "Saves"], "a.attendance": ["Asistencia total", "Total attendance"],
  "a.estBadge": ["est.", "est."],
  "a.attEstNote": ["Asistencia: estimada para todo el Mundial (aún sin dato oficial por partido). Se reemplaza por la suma real conforme se publica cada evento.",
                   "Attendance: estimated for the whole World Cup (no official per-match figure yet). It's replaced by the real sum as each event is published."],
  "a.attRealNote": ["Asistencia: suma real de los eventos publicados", "Attendance: real sum of published events"],
  // added (stoppage) time
  "at.kicker": ["Tiempo agregado", "Added time"],
  "at.title": ["Minutos agregados por partido", "Added minutes per match"],
  "at.sub": ["Promedio del Mundial 2026 con referencias de las dos ediciones anteriores.",
             "2026 average with references from the last two editions."],
  "at.avg": ["promedio por partido (2026)", "average per match (2026)"],
  "at.groups": ["Fase de grupos", "Group stage"],
  "at.knockouts": ["Eliminatorias", "Knockouts"],
  "at.total": ["Total acumulado", "Cumulative total"],
  // scorers ordering note + search
  "sc.foot": ["Orden oficial FIFA: goles, luego asistencias y menos minutos jugados (cuando hay datos). Los penales cuentan como gol.",
              "Official FIFA order: goals, then assists and fewest minutes played (when available). Penalties count as goals."],
  "sc.search": ["Buscar jugador o selección…", "Search player or team…"],
  "sc.top": ["Top 50 · orden FIFA", "Top 50 · FIFA order"],
  "sc.none": ["Sin coincidencias.", "No matches."],
  "sc.boot": ["Botín de Oro", "Golden Boot"],
  // chart accessibility
  "a11y.chart": ["Gráfica", "Chart"],
  "a11y.skip": ["Saltar al contenido", "Skip to content"],
  "a11y.item": ["Concepto", "Item"],
  "a11y.table": ["Tabla de datos de la gráfica", "Chart data table"],
  "a11y.top": ["Volver arriba", "Back to top"],
  // facts
  "f.highest": ["Partido más goleador", "Highest-scoring match"], "f.biggest": ["Mayor goleada", "Biggest win"],
  "f.fastest": ["Gol más madrugador", "Earliest goal"], "f.latest": ["Gol más tardío", "Latest goal"],
  "f.hattricks": ["Hat-tricks", "Hat-tricks"], "f.comebacks": ["Remontadas", "Comebacks"],
  "f.shootouts": ["Tandas de penales", "Penalty shootouts"], "f.cleansheets": ["Porterías en cero", "Clean sheets"],
  "f.zerozero": ["Empates 0–0", "0–0 draws"], "f.blowouts": ["Goleadas (3+)", "Blowouts (3+)"],
  "f.pengoals": ["Goles de penal", "Penalty goals"], "f.topattack": ["Ataque más letal", "Deadliest attack"],
  "f.diff": ["de diferencia", "goal margin"], "f.min": ["Min.", "Min."],
  "f.none": ["Aún ninguno", "None yet"], "f.andMore": [" y más", " and more"],
  "f.dmComeback": ["Perdían al descanso y ganaron", "Trailed at half-time, then won"],
  "f.dmShootout": ["Definidos desde los once pasos", "Decided from the spot"],
  "f.dmClean": ["Partidos con valla invicta", "Matches with a clean sheet"],
  "f.dmZero": ["Duelos sin goles", "Goalless games"],
  "f.dmBlow": ["Partidos con diferencia de 3 o más", "Matches won by 3+"],
  "f.dmPen": ["Anotados desde el manchón", "Scored from the spot"],
  // discipline KPIs
  "d.mostFouls": ["Selección más infractora (faltas/partido)", "Most-fouling team (fouls/match)"],
  "d.mostEff": ["Mayor eficacia (% de conversión)", "Most efficient (conversion %)"],
  "d.leastEff": ["Menor eficacia (% de conversión)", "Least efficient (conversion %)"],
  "d.foulsPerMatch": ["faltas/partido", "fouls/match"],
  "d.shotsGoals": ["tiros · {g} goles", "shots · {g} goals"],
  // bracket
  "br.r32": ["Dieciseisavos", "Round of 32"], "br.r16": ["Octavos", "Round of 16"],
  "br.qf": ["Cuartos", "Quarter-finals"], "br.sf": ["Semifinal", "Semi-finals"], "br.final": ["Final", "Final"],
  "br.third": ["Tercer lugar", "Third place"],
  "br.matchday": ["Jornada", "Matchday"],
  "br.legend": ["Cuadro proyectado en vivo con la clasificación actual. Toca un duelo para ver sede y horario.",
                "Live projected bracket from current standings. Tap a tie for venue and kickoff."],
  "br.proj": ["proy.", "proj."],
  "br.projFull": ["Proyección según los resultados de hoy", "Projection based on today's results"],
  "br.swipe": ["Desliza para ver más rondas →", "Swipe to see more rounds →"],
  "br.qualified": ["clasificado", "qualified"],
  "br.winner": ["Ganador", "Winner"],
  "br.best3": ["Mejor 3.º", "Best 3rd"],
  "br.pos1": ["1.º", "1st"], "br.pos2": ["2.º", "2nd"],
  "br.tbdNote": ["Por definir según resultados", "To be decided by results"],

  // chart drill-down
  "drill.hint": ["Toca una barra (o «Ver detalle») para profundizar ↗", "Tap a bar (or “See detail”) to drill down ↗"],
  "drill.detail": ["Ver detalle", "See detail"],
  "drill.pick": ["Elige una para ver su detalle:", "Pick one to see its detail:"],
  "drill.close": ["Cerrar", "Close"],
  "drill.matches": ["Partidos", "Matches"],
  "drill.noData": ["Sin detalle disponible todavía.", "No detail available yet."],
  "drill.group": ["Grupo", "Group"],
  "drill.played": ["jugados", "played"],
  "drill.goalsFor": ["Goles a favor", "Goals for"],
  "drill.shotsOn": ["Tiros a puerta", "Shots on target"],
  "drill.conv": ["Conversión", "Conversion"],
  "drill.foulsPm": ["Faltas por partido", "Fouls per match"],
  "drill.pts": ["Puntos", "Points"],

  // social fallback
  "social.fail": ["No se pudo cargar el feed aquí — ábrelo en la app ↗", "Couldn't load the feed here — open it in the app ↗"],

  // stats in-page sub-nav
  "subnav.kpis": ["Cifras", "Numbers"], "subnav.facts": ["Curiosidades", "Fun facts"],
  "subnav.agg": ["Agregados", "Aggregates"], "subnav.viz": ["Gráficas", "Charts"],
  "subnav.disc": ["Disciplina", "Discipline"], "subnav.eff": ["Eficacia", "Efficiency"],
  "subnav.rc": ["Rojas y lesiones", "Reds & injuries"],


  // host pills + short card kickers
  "host.ca": ["🇨🇦 Canadá", "🇨🇦 Canada"], "host.mx": ["🇲🇽 México", "🇲🇽 Mexico"], "host.us": ["🇺🇸 USA", "🇺🇸 USA"],
  "kick.fouls": ["Juego brusco", "Rough play"],

  // essential rules (rich text)
  "rules.r1": ["<b>48 selecciones</b><p>Formato ampliado: 12 grupos de 4 equipos, 104 partidos en total.</p>",
               "<b>48 teams</b><p>Expanded format: 12 groups of 4, 104 matches in total.</p>"],
  "rules.r2": ["<b>Nueva ronda de 32</b><p>Avanzan los 2 primeros de cada grupo + los 8 mejores terceros (32 a eliminatorias).</p>",
               "<b>New Round of 32</b><p>Top 2 of each group + the 8 best third-placed teams advance (32 to knockouts).</p>"],
  "rules.r3": ["<b>Plantillas de 26</b><p>Cada selección puede registrar hasta 26 jugadores (y 26 en convocatoria por partido).</p>",
               "<b>26-player squads</b><p>Each team may register up to 26 players (26 in the matchday squad).</p>"],
  "rules.r4": ["<b>5 cambios</b><p>Hasta 5 sustituciones en 3 ventanas, más un cambio extra por conmoción cerebral.</p>",
               "<b>5 substitutions</b><p>Up to 5 subs in 3 windows, plus an extra concussion substitution.</p>"],
  "rules.r5": ["<b>VAR y fuera de lugar semiautomático</b><p>Tecnología de offside semiautomática; el árbitro anuncia por altavoz las decisiones del VAR.</p>",
               "<b>VAR & semi-automated offside</b><p>Semi-automated offside tech; referees announce VAR calls over the PA.</p>"],
  "rules.r6": ["<b>Tiempo añadido estricto</b><p>Se compensa con precisión el tiempo perdido; 8 s máximo para que el portero suelte el balón.</p>",
               "<b>Strict added time</b><p>Lost time is compensated precisely; keepers get max 8 s to release the ball.</p>"],
  "rules.r7": ["<b>16 sedes, 3 países</b><p>Canadá, México y EE. UU.; la final será en el MetLife Stadium (Nueva York/Nueva Jersey).</p>",
               "<b>16 venues, 3 countries</b><p>Canada, Mexico and the USA; the final is at MetLife Stadium (New York/New Jersey).</p>"],
  "rules.r8": ["<b>39 días de torneo</b><p>Del 11 de junio al 19 de julio de 2026, la Copa del Mundo más larga de la historia.</p>",
               "<b>39-day tournament</b><p>From 11 June to 19 July 2026 — the longest World Cup ever.</p>"],
  "rules.r9": ["<b>Pausas de hidratación</b><p>En sedes con calor extremo (México, Dallas, Houston…) el árbitro detiene el juego ~3 min cerca del minuto 30 y 75 para que los jugadores se hidraten.</p>",
               "<b>Hydration breaks</b><p>At hot venues (Mexico City, Dallas, Houston…) the referee pauses play ~3 min around the 30th and 75th minute so players can rehydrate.</p>"],
};

export function t(key) {
  const e = STR[key];
  if (!e) return key;
  return lang === "en" ? (e[1] ?? e[0]) : e[0];
}

export function tName(name) {
  return lang === "en" ? (name || "") : teamES(name);
}

export function applyStatic(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.getAttribute("data-i18n")); });
  root.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
  root.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph"))); });
}
