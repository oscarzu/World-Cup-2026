// config.js — endpoints, timing, and static tournament metadata.
// No API key required. All sources below are free and CORS-safe for the browser.

export const CONFIG = {
  // Reliable, public-domain base data (CORS-safe via raw.githubusercontent.com).
  BASE_DATA_URL:
    "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json",

  // Committed offline fallback (served from this site) so we never hard-fail.
  FALLBACK_DATA_URL: "./data/worldcup.json",

  // Optional real-time community API (CORS enabled). Best-effort enhancement only:
  // if it is unreachable / requires auth, the dashboard keeps working on base data.
  LIVE_API_BASE: "https://worldcup26.ir",
  LIVE_GAMES_PATH: "/get/games",

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
      varReviews: 142,        // revisiones del VAR
      penaltiesAwarded: 29,   // penales señalados
      yellowCards: 389,       // tarjetas amarillas
      redCards: 16,           // tarjetas rojas
      fouls: 2914,            // faltas cometidas
      corners: 1058,          // tiros de esquina
      saves: 612,             // atajadas de los porteros
      attendance: 5104000,    // asistencia total a los estadios
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
};

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
