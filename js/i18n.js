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
  "tab.predict": ["Predicciones", "Predictions"],
  "tab.venues": ["Sedes", "Venues"],

  // matches hub: list vs bracket sub-views
  "mv.list": ["📅 Calendario", "📅 Schedule"],
  "mv.bracket": ["🏆 Eliminatorias", "🏆 Knockouts"],
  // live match centre on the home page
  "live.kicker": ["En vivo", "Live now"],
  "live.nowTitle": ["Partidos en juego", "Matches in play"],
  // predictions on the home page
  "pred.homeKicker": ["Modelo predictivo", "Predictive model"],
  // road to R32, moved to the Groups tab (past tense — results are final)
  "q.kickerPast": ["Camino a la ronda de 32", "Road to the Round of 32"],
  "q.titlePast": ["Así quedó la clasificación", "How qualification finished"],

  // predictions
  "pred.kicker": ["Modelo predictivo", "Predictive model"],
  "pred.title": ["Probabilidades de los próximos partidos", "Odds for the upcoming matches"],
  "pred.sub": ["Modelo Poisson con prior Elo y forma actual: marcador más probable y probabilidad de cada resultado.",
               "Poisson model with an Elo prior and current form: most-likely score and outcome probabilities."],
  "pred.draw": ["Empate", "Draw"],
  "pred.xg": ["Goles esperados", "Expected goals"],
  "pred.none": ["Aún no hay partidos confirmados próximos para predecir.", "No confirmed upcoming matches to predict yet."],
  "pred.confTitle": ["Confianza del modelo", "Model confidence"],
  "pred.acc": ["Aciertos de resultado", "Outcome accuracy"],
  "pred.rps": ["RPS (menor = mejor)", "RPS (lower = better)"],
  "pred.vs": ["azar", "random"],
  "pred.tested": ["Partidos validados", "Matches tested"],
  "pred.cf.low": ["baja", "low"], "pred.cf.lowmod": ["baja-moderada", "low-moderate"],
  "pred.cf.mod": ["moderada", "moderate"], "pred.cf.modhigh": ["moderada-alta", "moderate-high"],
  "pred.advance": ["avanza", "advances"],
  "pred.pens": ["penales", "shootout"],
  "pred.ko": ["Eliminatoria · sin empate", "Knockout · no draws"],
  "pred.penNote": ["Probabilidad de que el partido se defina en penales. La fuerza desde el manchón es a nivel selección (último año + histórico de tandas).",
                   "Chance the tie goes to a shootout. Spot-kick strength is team-level (last year + historical shootout record)."],
  "pred.note": ["Parámetros fijos (no ajustados al pasado, para evitar overfitting). Validación walk-forward: cada partido se predice usando solo datos previos. En eliminatorias no hay empate: la probabilidad se reparte entre prórroga y penales (fuerza desde el manchón por selección). Con pocos partidos la confianza es baja y mejora conforme avanza el torneo. No es consejo de apuestas.",
                "Fixed parameters (not tuned to the past, to avoid overfitting). Walk-forward validation: each match is predicted using only prior data. In knockouts there are no draws — the probability is split between extra time and penalties (team-level spot-kick strength). With few games confidence is low and improves as the tournament progresses. Not betting advice."],
  "pred.reportKicker": ["Aciertos del modelo", "Model accuracy"],
  "pred.reportTitle": ["Pronóstico vs. resultado real", "Forecast vs. actual result"],
  "pred.reportSub": ["Qué tan bien acertó el modelo en los partidos ya jugados (validación sin trampa, sin ver el futuro).",
                     "How well the model did on already-played matches (honest validation, no look-ahead)."],
  "pred.repNone": ["Aún no hay partidos suficientes para evaluar el modelo.", "Not enough played matches yet to score the model."],
  "pred.repAcc": ["Acierto (1X2)", "Accuracy (1X2)"],
  "pred.repExact": ["Marcador exacto", "Exact score"],
  "pred.repPick": ["Pronóstico", "Pick"],
  "pred.repHit": ["Acertó", "Hit"],
  "pred.repMiss": ["Falló", "Miss"],
  "pred.repNote": ["Cada partido se pronosticó usando solo los resultados previos (walk-forward). Se muestran los más recientes.",
                   "Each match was forecast using only earlier results (walk-forward). Most recent shown."],
  // VAR incident detail
  "a.varNote": ["Incidencias destacadas (ilustrativas; no hay un feed público con el desglose por jugada).",
                "Notable incidents (illustrative; there's no public feed with the play-by-play breakdown)."],
  // qualification tables
  "q.qualifiedTitle": ["Clasificados por grupo", "Qualified by group"],
  "q.thStatus": ["Estado", "Status"],
  "q.thIn": ["Clasifica", "Qualifies"],
  "q.thOut": ["Fuera", "Out"],

  // hero
  "hero.title": ["La 23.ª Copa Mundial de la FIFA", "The 23rd FIFA World Cup"],
  "hero.text": ["Primera edición con <strong>48 selecciones</strong>, repartida en tres países anfitriones y <strong>16 sedes</strong>.",
                "The first edition with <strong>48 teams</strong>, across three host nations and <strong>16 venues</strong>."],
  "host.cst": ["Horarios en CST", "Times in CST"],
  "hero.next": ["Próximo partido", "Next match"],
  "hero.live": ["¡En juego!", "Kicking off!"],

  // generic section heads / cards
  "ov.next": ["Próximos y en vivo", "Live & upcoming"],
  "ov.seeAll": ["Ver todos los partidos", "See all matches"],
  "ov.goalsByMd": ["Goles por fase", "Goals by phase"],
  "foot.goalsByMd": ["Fase de grupos y cada ronda de eliminatoria (16vos → final) · eje en escala logarítmica", "Group stage and each knockout round (R32 → final) · log-scale axis"],
  "ph.group": ["Fase de grupos", "Group stage"],
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
  "eff.histKicker": ["Histórico · por fase", "History · by phase"],
  "eff.histTitle": ["Más eficaz vs. menos eficaz — por fase", "Most vs. least efficient — by phase"],
  "eff.cumTitle": ["Más eficaz vs. menos eficaz — acumulado", "Most vs. least efficient — cumulative"],
  "eff.histFoot": ["% de conversión real (goles ÷ tiros a puerta) por fase; cada ronda de eliminación aparece al completarse. Sin datos en vivo se muestra la fase de grupos (ilustrativo).",
                   "Real conversion % (goals ÷ shots on target) by phase; each knockout round appears once complete. Without live data the group stage is shown (illustrative)."],
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
  "cardsChart.title": ["Amarillas acumuladas en el torneo", "Yellow cards accumulated in the tournament"],
  "cardsChart.foot": ["Top 10 · contamos todas las amarillas del torneo. Para sanción, la acumulación se reinicia tras la fase de grupos y de nuevo tras los cuartos de final (nadie se pierde la final por amarillas).",
                      "Top 10 · we count every yellow of the tournament. For suspensions, accumulation resets after the group stage and again after the quarter-finals (no one misses the final on yellows)."],
  "groupsChart.title": ["Goles por grupo", "Goals by group"],
  "groupsChart.foot": ["Goles por grupo", "Goals by group"],
  "teamsChart.title": ["Selecciones más goleadoras", "Top-scoring teams"],
  "teamsChart.foot": ["Top 8 por goles anotados", "Top 8 by goals scored"],
  "momentsChart.title": ["Momentos del torneo", "Tournament moments"],
  "momentsChart.foot": ["Conteo de partidos memorables", "Memorable match counts"],

  // card kickers (short eyebrows on chart cards)
  "kick.scoring": ["Goleo", "Scoring"],
  "kick.attack": ["Ataque", "Attack"],
  "kick.drama": ["Drama", "Drama"],
  "kick.cards": ["Tarjetas", "Cards"],

  // venue facts
  "venue.built": ["Inaugurado", "Opened"],
  "venue.capacity": ["Capacidad", "Capacity"],
  "venue.cost": ["Costo aprox.", "Approx. cost"],

  // live stats + social block
  "live.shots": ["Tiros a arco", "Shots on goal"],
  "live.fouls": ["Faltas", "Fouls"],
  "social.igFeed": ["📸 Feed en vivo · Instagram", "📸 Live feed · Instagram"],
  "social.openIg": ["Abrir en Instagram ↗", "Open in Instagram ↗"],
  "social.xPosts": ["Publicaciones de @FIFAWorldCup", "Posts from @FIFAWorldCup"],
  "social.openX": ["Abrir en X ↗", "Open on X ↗"],
  "social.archiveK": ["Archivo social", "Social archive"],
  "social.archiveT": ["Instagram por jornada y sede", "Instagram by matchday & venue"],
  "social.archiveS": ["Cada día se arma solo con las sedes de esos partidos. Explora por estadio o mira las publicaciones guardadas; las jornadas pasadas quedan como histórico.",
                      "Each day is built automatically from that day's venues. Explore by stadium or browse saved posts; past matchdays remain as history."],

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
  "credit": ["Reglamento: Reglamento oficial de la FIFA 26 · En vivo y estadísticas: ESPN · Calendario base: openfootball (dominio público) · Banderas: flagcdn.com · Visualización con Chart.js.",
             "Rules: official FIFA 26 regulations · Live & stats: ESPN · Base fixtures: openfootball (public domain) · Flags: flagcdn.com · Charts by Chart.js."],
  "credit.dim": ["Autor: Zuriel Santibañez", "Author: Zuriel Santibañez"],

  // units / common words used in dynamic strings
  "u.goals": ["goles", "goals"],
  "u.goal": ["gol", "goal"],
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
  "sc.podiumNote": ["Con resultados al día — el torneo aún no termina.", "Standings so far — the tournament isn't over yet."],
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
  "f.pengoals": ["Goles de penal", "Penalty goals"],
  "f.topattack": ["Selecciones con más goles", "Teams with the most goals"],
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
  // road to the Round of 32
  "q.kicker": ["Camino a la ronda de 32", "Road to the Round of 32"],
  "q.title": ["Quién está clasificado hoy", "Who's qualified today"],
  "q.explain": ["<strong>32 equipos</strong> avanzan: los <strong>2 primeros</strong> de cada uno de los 12 grupos (24) más los <strong>8 mejores terceros</strong>. Los 12 terceros se ordenan por: <strong>1)</strong> puntos, <strong>2)</strong> diferencia de goles, <strong>3)</strong> goles a favor y, si siguen empatados, fair-play y sorteo. Los 8 primeros de esa lista pasan.",
                "<strong>32 teams</strong> advance: the <strong>top 2</strong> of each of the 12 groups (24) plus the <strong>8 best third-placed teams</strong>. The 12 thirds are ranked by: <strong>1)</strong> points, <strong>2)</strong> goal difference, <strong>3)</strong> goals scored and, if still level, fair-play and drawing of lots. The top 8 of that list go through."],
  "q.firsts": ["1.º de grupo", "Group winners"],
  "q.seconds": ["2.º de grupo", "Runners-up"],
  "q.thirdsTitle": ["Mejores terceros", "Best third-placed teams"],
  "q.cut": ["línea de corte: top 8", "cut line: top 8"],
  "q.whatifTitle": ["Cómo terminó cada grupo", "How each group finished"],
  "q.in": ["Top 2", "Top 2"],
  "q.live": ["En disputa", "In contention"],
  "q.out": ["3.º o menos", "3rd or below"],
  "q.advTop": ["Avanzó", "Advanced"],
  "q.advThird": ["Avanzó (mejor 3.º)", "Advanced (best 3rd)"],
  "q.elim": ["Eliminado", "Eliminated"],
  "q.noteProj": ["Proyección con los resultados de hoy; cambia con cada partido. «Sin opción de top 2» no significa eliminado: un tercero aún puede clasificar entre los 8 mejores.",
                 "Projection from today's results; it changes every match. “No top-2 path” isn't elimination — a third-placed team can still qualify among the best 8."],
  "q.noteDone": ["Fase de grupos completa: clasificados definitivos.", "Group stage complete: final qualifiers."],

  // bracket
  "br.r32": ["Dieciseisavos", "Round of 32"], "br.r16": ["Octavos", "Round of 16"],
  "br.qf": ["Cuartos", "Quarter-finals"], "br.sf": ["Semifinal", "Semi-finals"], "br.final": ["Final", "Final"],
  "br.third": ["Tercer lugar", "Third place"],
  "br.matchday": ["Jornada", "Matchday"],
  "br.legend": ["Cuadro en vivo con la clasificación actual. Cada llave muestra su número de partido (#) para identificar de dónde sale cada cruce; p. ej. «Ganador #97» avanza desde el partido #97.",
                "Live bracket from current standings. Each tie shows its match number (#) so you can trace each pairing; e.g. “Winner #97” advances from match #97."],
  "br.game": ["Partido", "Match"],
  "br.pens": ["pen.", "pen."],
  "br.aet": ["t. extra", "a.e.t."],
  "cal.add": ["📅 Añadir al calendario", "📅 Add to calendar"],
  "cal.download": ["📅 Descargar (.ics)", "📅 Download (.ics)"],
  "cal.subscribe": ["📅 Suscribirse (se actualiza solo)", "📅 Subscribe (auto-updates)"],
  "br.proj": ["proy.", "proj."],
  "br.projFull": ["Proyección según los resultados de hoy", "Projection based on today's results"],
  "br.swipe": ["Desliza para ver más rondas →", "Swipe to see more rounds →"],
  "br.qualified": ["clasificado", "qualified"],
  "br.winner": ["Ganador", "Winner"],
  "br.best3": ["Mejor 3.º", "Best 3rd"],
  "br.pos1": ["1.º", "1st"], "br.pos2": ["2.º", "2nd"],
  "br.tbdNote": ["Por definir según resultados", "To be decided by results"],

  // chart drill-down
  "drill.hint": ["Toca una barra para ver el detalle ↗", "Tap a bar to see the detail ↗"],
  "cal.subTitle": ["Suscríbete al calendario", "Subscribe to the calendar"],
  "cal.subBody": ["Se actualiza solo conforme avanzan las eliminatorias. Copia esta URL en tu app de calendario (Suscribirse por URL) o usa los botones:",
                  "Auto-updates as the knockouts advance. Copy this URL into your calendar app (Subscribe by URL) or use the buttons:"],
  "cal.copy": ["Copiar URL", "Copy URL"],
  "cal.copied": ["¡Copiada!", "Copied!"],
  "cal.gcal": ["Google Calendar", "Google Calendar"],
  "cal.apple": ["Apple / Outlook (webcal)", "Apple / Outlook (webcal)"],
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
  "drill.gfga": ["(GF-GC)", "(GF-GA)"],
  "drill.minute": ["Minuto del gol", "Goal minute"],
  "drill.scorer": ["Autor del gol", "Scorer"],
  "drill.groupGoals": ["Goles del grupo", "Group goals"],
  "drill.groupLegend": ["✅ avanzó · ❌ eliminado · pts = puntos · GF-GC = goles a favor y en contra",
                        "✅ advanced · ❌ eliminated · pts = points · GF-GA = goals for and against"],
  "drill.scorerSub": ["contra qué selecciones marcó", "which teams they scored against"],
  "drill.mdSub": ["Goles de la fase de grupos, jornada por jornada (J1–J17).", "Group-stage goals, matchday by matchday (MD1–MD17)."],

  // social fallback
  "social.fail": ["No se pudo cargar el feed aquí — ábrelo en la app ↗", "Couldn't load the feed here — open it in the app ↗"],

  // stats in-page sub-nav
  "subnav.kpis": ["Cifras", "Numbers"], "subnav.facts": ["Curiosidades", "Fun facts"],
  "subnav.agg": ["Agregados", "Aggregates"], "subnav.viz": ["Gráficas", "Charts"],
  "subnav.disc": ["Disciplina", "Discipline"], "subnav.eff": ["Eficacia", "Efficiency"],
  "subnav.gk": ["Porteros", "Keepers"], "subnav.pk": ["Penales", "Shootouts"],
  "subnav.rc": ["Rojas y lesiones", "Reds & injuries"],

  // goalkeeping
  "gk.kicker": ["Porteros · la muralla", "Keepers · the wall"],
  "gk.title": ["Quién detiene más tiros a puerta", "Who stops the most shots on target"],
  "gk.sub": ["% de paradas = tiros a puerta detenidos ÷ recibidos. Por selección (portería + defensa).",
             "Save % = shots on target saved ÷ faced. Per team (keeper + defense)."],
  "gk.chartKicker": ["Muralla", "The wall"],
  "gk.chartTitle": ["Mejor % de paradas", "Best save %"],
  "gk.chartFoot": ["Top 10 · una parada = tiro a puerta recibido que no terminó en gol",
                   "Top 10 · a save = a shot on target faced that didn't end in a goal"],
  "gk.cleanTitle": ["Arcos que no vieron el balón", "Nets that never saw the ball"],
  "gk.cleanFoot": ["Partidos sin recibir gol (portería a cero)", "Matches without conceding (clean sheets)"],
  "gk.best": ["Mejor % de paradas", "Best save %"],
  "gk.mostSaves": ["Más paradas", "Most saves"],
  "gk.mostClean": ["Arcos que no vieron el balón", "Nets that never saw the ball"],
  "gk.stops": ["paradas", "saves"],
  "gk.none": ["Aún sin datos de tiros recibidos (se activan al desplegar el Worker).",
              "No shots-faced data yet (activates once the Worker is deployed)."],

  // penalty shootouts
  "pk.kicker": ["Once contra portero", "One-on-one from the spot"],
  "pk.title": ["Tandas de penales", "Penalty shootouts"],
  "pk.sub": ["Los duelos que se decidieron desde los once metros.", "The ties decided from twelve yards."],
  "pk.none": ["Todavía no hay tandas de penales en el torneo.", "No penalty shootouts in the tournament yet."],
  "pk.aet": ["Tras 120’:", "After 120’:"],
  "pk.record": ["Récord en tandas", "Shootout record"],
  "pk.w": ["G", "W"], "pk.l": ["P", "L"], "pk.scored": ["anotados", "scored"],


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
  "rules.r9": ["<b>Pausas de refresco</b><p>En clima extremo, el árbitro puede ordenar pausas para beber (típicamente cerca del minuto 30 y 75); se decide caso por caso según el protocolo médico de la FIFA.</p>",
               "<b>Cooling breaks</b><p>In extreme heat the referee may call drinks breaks (typically around the 30th and 75th minute); decided case by case under FIFA's medical protocol.</p>"],
  "rules.r10": ["<b>Las amarillas se reinician dos veces</b><p>Dos amarillas en partidos distintos = un partido de suspensión. La cuenta para sanción se borra <b>tras la fase de grupos</b> y otra vez <b>tras los cuartos de final</b>, así que nadie se pierde la final por amarillas acumuladas.</p>",
                "<b>Yellow cards reset twice</b><p>Two yellows in separate games = a one-match ban. The suspension count is wiped <b>after the group stage</b> and again <b>after the quarter-finals</b>, so no one misses the final on accumulated yellows.</p>"],
  "rules.r11": ["<b>Prórroga y penales</b><p>En eliminación directa, si hay empate se juega una <b>prórroga de 2×15 min</b> y, si persiste, <b>tanda de penales</b>. En la prórroga cada equipo dispone de un cambio y una ventana de sustitución adicionales.</p>",
                "<b>Extra time &amp; penalties</b><p>In the knockouts, a draw goes to <b>2×15 min extra time</b> and, if still level, a <b>penalty shootout</b>. In extra time each side gets one extra substitution and window.</p>"],
  "rules.r12": ["<b>Desempate en los grupos</b><p>A igualdad de puntos: <b>1)</b> resultados entre las empatadas (puntos, dif. de goles, goles), <b>2)</b> dif. de goles global, <b>3)</b> goles, <b>4)</b> fair-play (amarilla −1, roja −3/−4), <b>5)</b> ranking FIFA.</p>",
                "<b>Group tie-breakers</b><p>On equal points: <b>1)</b> head-to-head among the tied teams (points, goal difference, goals), <b>2)</b> overall goal difference, <b>3)</b> goals, <b>4)</b> fair-play (yellow −1, red −3/−4), <b>5)</b> FIFA ranking.</p>"],
  "rules.r13": ["<b>Anfitriones con lugar fijo</b><p>Por reglamento, <b>México es A1</b>, <b>Canadá B1</b> y <b>EE. UU. D1</b>: las tres sedes locales abren su grupo como cabezas de serie.</p>",
                "<b>Hosts in fixed slots</b><p>By regulation, <b>Mexico is A1</b>, <b>Canada B1</b> and the <b>USA D1</b>: the three host nations open their group as seeds.</p>"],
  "rules.source": ["📄 Fuente: Reglamento oficial de la FIFA 26 (PDF)", "📄 Source: official FIFA 26 regulations (PDF)"],
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
