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
export const VENUES = {
  Atlanta: { stadium: "Mercedes-Benz Stadium", city: "Atlanta", country: "USA" },
  "Boston (Foxborough)": { stadium: "Gillette Stadium", city: "Foxborough", country: "USA" },
  "Dallas (Arlington)": { stadium: "AT&T Stadium", city: "Arlington", country: "USA" },
  "Guadalajara (Zapopan)": { stadium: "Estadio Akron", city: "Guadalajara", country: "Mexico" },
  Houston: { stadium: "NRG Stadium", city: "Houston", country: "USA" },
  "Kansas City": { stadium: "Arrowhead Stadium", city: "Kansas City", country: "USA" },
  "Los Angeles (Inglewood)": { stadium: "SoFi Stadium", city: "Inglewood", country: "USA" },
  "Mexico City": { stadium: "Estadio Azteca", city: "Mexico City", country: "Mexico" },
  "Miami (Miami Gardens)": { stadium: "Hard Rock Stadium", city: "Miami Gardens", country: "USA" },
  "Monterrey (Guadalupe)": { stadium: "Estadio BBVA", city: "Monterrey", country: "Mexico" },
  "New York/New Jersey (East Rutherford)": { stadium: "MetLife Stadium", city: "East Rutherford", country: "USA" },
  Philadelphia: { stadium: "Lincoln Financial Field", city: "Philadelphia", country: "USA" },
  "San Francisco Bay Area (Santa Clara)": { stadium: "Levi's Stadium", city: "Santa Clara", country: "USA" },
  Seattle: { stadium: "Lumen Field", city: "Seattle", country: "USA" },
  Toronto: { stadium: "BMO Field", city: "Toronto", country: "Canada" },
  Vancouver: { stadium: "BC Place", city: "Vancouver", country: "Canada" },
};
