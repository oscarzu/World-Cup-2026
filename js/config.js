// config.js — endpoints, timing, and static tournament metadata.
// No API key required. All sources below are free and CORS-safe for the browser.

export const CONFIG = {
  // Reliable, public-domain base data (CORS-safe via raw.githubusercontent.com).
  BASE_DATA_URL:
    "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json",

  // Committed offline fallback (served from this site) so we never hard-fail.
  FALLBACK_DATA_URL: "./data/worldcup.json",

  // Curated stats layer (fouls, shots on target, yellow cards) that openfootball
  // doesn't provide. Swap this URL for a live provider to get instant data.
  TEAM_STATS_URL: "./data/teamstats.json",

  // Per-matchday shooting-efficacy history (illustrative; powers the historical chart).
  EFFICACY_HISTORY_URL: "./data/efficacy-history.json",

  // Curated Instagram posts per date (YYYY-MM-DD) for the "social por jornada" archive.
  SOCIAL_DATA_URL: "./data/social.json",
  // Optional live Instagram feed widget (LightWidget / Behold) iframe URL. Empty = off.
  SOCIAL_WIDGET_URL: "",

  // Optional real-time community API (CORS enabled). Best-effort enhancement only:
  // if it is unreachable / requires auth, the dashboard keeps working on base data.
  LIVE_API_BASE: "https://worldcup26.ir",
  LIVE_GAMES_PATH: "/get/games",

  // ---- Real-time provider via Cloudflare Worker proxy (API-Football) ----
  // Leave empty to use the bundled curated stats. Once you deploy the worker
  // (see worker/README.md) paste its URL here, e.g.
  //   "https://wc26-football-proxy.<your-subdomain>.workers.dev"
  // The proxy holds your API key server-side, so it is never exposed here.
  LIVE_PROXY_URL: "https://wc26-football-proxy.oscarzu.workers.dev",
  LIVE_LEAGUE: 1,     // API-Football league id for the FIFA World Cup
  LIVE_SEASON: 2026,
  LIVE_POLL: 5 * 60 * 1000,       // refresh live data every 5 min (only while the tab is visible)
  LIVE_POLL_IDLE: 15 * 60 * 1000, // back off to 15 min when no match is live

  // Cache TTLs (ms).
  BASE_TTL: 60 * 60 * 1000, // base fixtures: 1h
  LIVE_TTL: 45 * 1000,      // live overlay: 45s

  // How often to re-poll for live updates while the page is open.
  POLL_INTERVAL: 45 * 1000,

  // Display all kickoff times in this zone. America/Mexico_City sits at a fixed
  // UTC-6 year-round (no DST since 2023), i.e. exactly CST.
  TIMEZONE: "America/Mexico_City",
  TIMEZONE_LABEL: "CST",

  // Tournament facts.
  TOURNAMENT: {
    name: "FIFA World Cup 2026",
    hosts: ["Canada", "Mexico", "USA"],
    start: "2026-06-11",
    end: "2026-07-19",
    teams: 48,
    groups: 12,
    matches: 104,
    stadiums: 16,

    // Tournament-wide aggregates that can't be derived from the fixtures/scores
    // alone (offsides, cards, VAR, etc.). These are illustrative competition
    // totals shown in the "Datos curiosos" section.
    aggregates: {
      offsides: 218,          // total fueras de lugar
      disallowedGoals: 14,    // goles anulados (VAR / fuera de lugar)
      varRestoredGoals: 9,    // goles desanulados (validados tras revisión del VAR)
      varReviews: 142,        // revisiones del VAR
      penaltiesAwarded: 29,   // penales señalados
      yellowCards: 389,       // tarjetas amarillas
      redCards: 16,           // tarjetas rojas
      fouls: 2914,            // faltas cometidas
      corners: 1058,          // tiros de esquina
      saves: 612,             // atajadas de los porteros
      attendance: 5104000,    // asistencia total estimada (todo el Mundial)
    },

    // Added (stoppage) time. Illustrative estimate for 2026 with reference
    // averages from the last two World Cups (Qatar 2022 set records for
    // strict time-keeping). Per-phase totals are cumulative estimates.
    addedTime: {
      avgPerMatch: 9.8,                       // min agregados por partido (prom., 2026 · estimado)
      ref: { wc2018: 6.6, wc2022: 11.6 },     // promedios de referencia (Rusia 2018, Qatar 2022)
      byPhase: { groups: 642, knockouts: 198 }, // minutos agregados acumulados (estimado)
      isEstimate: true,
    },
  },
};

// Country name -> ISO code used by flagcdn.com (https://flagcdn.com/<code>.svg).
export const FLAGS = {
  Algeria: "dz", Argentina: "ar", Australia: "au", Austria: "at", Belgium: "be",
  "Bosnia & Herzegovina": "ba", Brazil: "br", Canada: "ca", "Cape Verde": "cv",
  Colombia: "co", Croatia: "hr", "Curaçao": "cw", "Czech Republic": "cz",
  "DR Congo": "cd", Ecuador: "ec", Egypt: "eg", England: "gb-eng", France: "fr",
  Germany: "de", Ghana: "gh", Haiti: "ht", Iran: "ir", Iraq: "iq",
  "Ivory Coast": "ci", Japan: "jp", Jordan: "jo", Mexico: "mx", Morocco: "ma",
  Netherlands: "nl", "New Zealand": "nz", Norway: "no", Panama: "pa",
  Paraguay: "py", Portugal: "pt", Qatar: "qa", "Saudi Arabia": "sa",
  Scotland: "gb-sct", Senegal: "sn", "South Africa": "za", "South Korea": "kr",
  Spain: "es", Sweden: "se", Switzerland: "ch", Tunisia: "tn", Turkey: "tr",
  USA: "us", Uruguay: "uy", Uzbekistan: "uz",
  // Aliases for ESPN naming variants (so live flags resolve).
  "United States": "us", "Korea Republic": "kr", "IR Iran": "ir",
  "Côte d'Ivoire": "ci", "Cote d'Ivoire": "ci", Czechia: "cz",
  "Cabo Verde": "cv", "Türkiye": "tr", Turkiye: "tr",
  "Bosnia and Herzegovina": "ba", "Czech Republic ": "cz",
};

// Spanish (Mexico) names for selecciones. Display only — flag lookups keep the
// original key. Falls back to translating knockout placeholders word-by-word.
export const TEAM_ES = {
  Germany: "Alemania", Sweden: "Suecia", USA: "Estados Unidos", "United States": "Estados Unidos",
  Mexico: "México", "South Korea": "Corea del Sur", "Korea Republic": "Corea del Sur",
  Australia: "Australia", Netherlands: "Países Bajos", Japan: "Japón", Iran: "Irán", "IR Iran": "Irán",
  "New Zealand": "Nueva Zelanda", "Czech Republic": "República Checa", Czechia: "República Checa",
  Canada: "Canadá", "Bosnia & Herzegovina": "Bosnia y Herzegovina", "Bosnia and Herzegovina": "Bosnia y Herzegovina",
  Qatar: "Catar", Switzerland: "Suiza", Brazil: "Brasil", Morocco: "Marruecos", Scotland: "Escocia",
  Paraguay: "Paraguay", "Curaçao": "Curazao", "Ivory Coast": "Costa de Marfil",
  "Côte d'Ivoire": "Costa de Marfil", "Cote d'Ivoire": "Costa de Marfil",
  Tunisia: "Túnez", Belgium: "Bélgica", Egypt: "Egipto", "Saudi Arabia": "Arabia Saudita", Uruguay: "Uruguay",
  "South Africa": "Sudáfrica", Haiti: "Haití", Turkey: "Turquía", "Türkiye": "Turquía", Turkiye: "Turquía",
  Ecuador: "Ecuador", Spain: "España", "Cape Verde": "Cabo Verde", "Cabo Verde": "Cabo Verde",
  Algeria: "Argelia", Argentina: "Argentina", Austria: "Austria", Colombia: "Colombia", Croatia: "Croacia",
  "DR Congo": "RD Congo", England: "Inglaterra", France: "Francia", Ghana: "Ghana", Iraq: "Irak",
  Jordan: "Jordania", Norway: "Noruega", Panama: "Panamá", Portugal: "Portugal", Senegal: "Senegal",
  Uzbekistan: "Uzbekistán", Italy: "Italia", Denmark: "Dinamarca", Poland: "Polonia", Wales: "Gales",
  Serbia: "Serbia", Nigeria: "Nigeria", Cameroon: "Camerún",
};

export function teamES(name) {
  if (!name) return "";
  if (TEAM_ES[name]) return TEAM_ES[name];
  return String(name)
    .replace(/\bWinners?\b/gi, "Ganador")
    .replace(/\bRunners?-?up\b/gi, "2.º de")
    .replace(/\bGroup\b/gi, "Grupo")
    .replace(/\bThird place\b/gi, "Tercer lugar");
}

// Venue metadata keyed by the "ground" string used in the base data.
//   fifa    – official tournament name FIFA uses (sponsor-free)
//   stadium – the venue's real/original name
//   built   – year opened · capacity – seats for 2026 · cost – approx. build cost
//   img     – Wikimedia Commons file name (served via Special:FilePath, hi-res)
export const VENUES = {
  Atlanta: {
    fifa: "Atlanta Stadium", stadium: "Mercedes-Benz Stadium",
    city: "Atlanta", country: "USA",
    built: 2017, capacity: 71000, cost: "US$1,600 M", img: "Falcons Opening Day - MB Stadium.jpg",
  },
  "Boston (Foxborough)": {
    fifa: "Boston Stadium", stadium: "Gillette Stadium",
    city: "Foxborough", country: "USA",
    built: 2002, capacity: 65878, cost: "US$325 M", img: "Gillette Stadium.JPG",
  },
  "Dallas (Arlington)": {
    fifa: "Dallas Stadium", stadium: "AT&T Stadium",
    city: "Arlington", country: "USA",
    built: 2009, capacity: 80000, cost: "US$1,300 M", img: "AT&T Stadium 2022-08-24.jpg",
  },
  "Guadalajara (Zapopan)": {
    fifa: "Estadio Guadalajara", stadium: "Estadio Akron",
    city: "Guadalajara", country: "Mexico",
    built: 2010, capacity: 49850, cost: "US$197 M", img: "Estadio Omnilife Chivas.jpg",
  },
  Houston: {
    fifa: "Houston Stadium", stadium: "NRG Stadium",
    city: "Houston", country: "USA",
    built: 2002, capacity: 72220, cost: "US$352 M", img: "Reliant stadium.jpg",
  },
  "Kansas City": {
    fifa: "Kansas City Stadium", stadium: "Arrowhead Stadium",
    city: "Kansas City", country: "USA",
    built: 1972, capacity: 76416, cost: "US$43 M (1972)", img: "Arrowhead Stadium 2010.JPG",
  },
  "Los Angeles (Inglewood)": {
    fifa: "Los Angeles Stadium", stadium: "SoFi Stadium",
    city: "Inglewood", country: "USA",
    built: 2020, capacity: 70240, cost: "US$5,500 M", img: "SoFi Stadium.jpg",
  },
  "Mexico City": {
    fifa: "Estadio Ciudad de México", stadium: "Estadio Azteca",
    city: "Ciudad de México", country: "Mexico",
    built: 1966, capacity: 83264, cost: "US$26 M (1966)", img: "Estadio Azteca 1.JPG",
  },
  "Miami (Miami Gardens)": {
    fifa: "Miami Stadium", stadium: "Hard Rock Stadium",
    city: "Miami Gardens", country: "USA",
    built: 1987, capacity: 65326, cost: "US$115 M (1987)", img: "Hard Rock Stadium.jpg",
  },
  "Monterrey (Guadalupe)": {
    fifa: "Estadio Monterrey", stadium: "Estadio BBVA",
    city: "Monterrey", country: "Mexico",
    built: 2015, capacity: 53500, cost: "US$200 M", img: "Estadio BBVA Bancomer (1).jpg",
  },
  "New York/New Jersey (East Rutherford)": {
    fifa: "New York New Jersey Stadium", stadium: "MetLife Stadium",
    city: "East Rutherford", country: "USA",
    built: 2010, capacity: 82500, cost: "US$1,600 M", img: "MetLife Stadium exterior Super Bowl XLVIII.jpg",
  },
  Philadelphia: {
    fifa: "Philadelphia Stadium", stadium: "Lincoln Financial Field",
    city: "Philadelphia", country: "USA",
    built: 2003, capacity: 69176, cost: "US$512 M", img: "Lincoln Financial Field, Philadelphia, 2024.jpg",
  },
  "San Francisco Bay Area (Santa Clara)": {
    fifa: "San Francisco Bay Area Stadium", stadium: "Levi's Stadium",
    city: "Santa Clara", country: "USA",
    built: 2014, capacity: 68500, cost: "US$1,300 M", img: "Levi's Stadium from air.jpg",
  },
  Seattle: {
    fifa: "Seattle Stadium", stadium: "Lumen Field",
    city: "Seattle", country: "USA",
    built: 2002, capacity: 68740, cost: "US$430 M", img: "Artistic Design on Exterior of Lumen Field Stadium.jpg",
  },
  Toronto: {
    fifa: "Toronto Stadium", stadium: "BMO Field",
    city: "Toronto", country: "Canada",
    built: 2007, capacity: 45500, cost: "CA$62.9 M", img: "BMO Field, Toronto, Ontario (29969149766).jpg",
  },
  Vancouver: {
    fifa: "Vancouver Stadium", stadium: "BC Place",
    city: "Vancouver", country: "Canada",
    built: 1983, capacity: 54500, cost: "CA$126 M (1983)", img: "BC Place (Vancouver).jpg",
  },
};
