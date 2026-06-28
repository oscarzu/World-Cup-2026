// predictions.js — a transparent, overfitting-resistant match predictor.
//
// Model: independent Poisson goals with a Dixon–Coles low-score correction.
// Each team has an attack and a defence rating. Ratings BLEND two sources:
//   1) a pre-tournament prior derived from approximate world-football Elo
//      ("past data" — keeps early predictions sane), and
//   2) in-tournament goals scored/conceded ("current form").
// The blend uses shrinkage (a pseudo-count k of prior "games"), so with only
// 1–3 real games the prior dominates and the model can't overfit to noise.
// Few parameters, no per-match tuning, validated by back-testing (see backtest).

// Approximate pre-tournament Elo (world-football style). A PRIOR, not truth.
export const ELO = {
  Argentina: 2105, France: 2080, Spain: 2075, Brazil: 2050, England: 2030,
  Netherlands: 1995, Portugal: 1990, Belgium: 1940, Germany: 1955, Croatia: 1900,
  Uruguay: 1900, Colombia: 1895, Morocco: 1885, Switzerland: 1835, USA: 1815,
  Japan: 1810, Senegal: 1810, Mexico: 1800, Ecuador: 1790, "South Korea": 1785,
  Iran: 1780, Austria: 1815, Sweden: 1760, Norway: 1790, Egypt: 1760,
  Australia: 1720, Canada: 1735, Scotland: 1760, Tunisia: 1690, Algeria: 1755,
  Qatar: 1685, "Saudi Arabia": 1640, Paraguay: 1720, Panama: 1670, Ghana: 1705,
  "Ivory Coast": 1740, "South Africa": 1700, "Cape Verde": 1640, Jordan: 1565,
  Iraq: 1605, Uzbekistan: 1635, "DR Congo": 1690, "New Zealand": 1520, Haiti: 1520,
  "Curaçao": 1520, "Bosnia & Herzegovina": 1720, "Czech Republic": 1745, Turkey: 1820,
};
const DEFAULT_ELO = 1600;
const HOSTS = new Set(["Mexico", "USA", "Canada"]); // mild home edge in group stage

// Penalty-shootout strength (0–1). Team-level rating informed by the last ~year
// of penalty conversion plus historical shootout record (per-player taker data
// isn't available in our pipeline, so this is a squad-level proxy — see
// model.html). Higher = better from the spot.
export const PEN = {
  Argentina: 0.74, Croatia: 0.78, Germany: 0.72, Brazil: 0.60, France: 0.66,
  Netherlands: 0.66, Spain: 0.50, England: 0.62, Portugal: 0.64, Uruguay: 0.66,
  Colombia: 0.58, Morocco: 0.70, Switzerland: 0.56, USA: 0.56, Mexico: 0.52,
  Japan: 0.50, Senegal: 0.62, Ecuador: 0.56, "South Korea": 0.55, Iran: 0.58,
  Austria: 0.58, Sweden: 0.62, Norway: 0.60, Egypt: 0.66, Australia: 0.62,
  Canada: 0.54, Scotland: 0.55, Tunisia: 0.55, Algeria: 0.58, Qatar: 0.55,
  "Saudi Arabia": 0.54, Paraguay: 0.60, Panama: 0.55, Ghana: 0.46, "Ivory Coast": 0.60,
  "South Africa": 0.55, "Cape Verde": 0.55, Jordan: 0.52, Iraq: 0.54, Uzbekistan: 0.55,
  "DR Congo": 0.58, "New Zealand": 0.52, Haiti: 0.50, "Curaçao": 0.52,
  "Bosnia & Herzegovina": 0.58, "Czech Republic": 0.60, Turkey: 0.58,
};
const DEFAULT_PEN = 0.55;

const K_SHRINK = 5;      // pseudo-games of prior (regularization strength)
const HOME_ADV = 1.12;   // host home-field multiplier on expected goals
const DC_RHO = -0.06;    // Dixon–Coles low-score dependency (lifts draws / 1-0 / 0-1)
const MAX_GOALS = 9;

function fact(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
function pois(k, lambda) { return Math.exp(-lambda) * Math.pow(lambda, k) / fact(k); }
function dc(i, j, lh, la, rho) {
  if (i === 0 && j === 0) return 1 - lh * la * rho;
  if (i === 0 && j === 1) return 1 + lh * rho;
  if (i === 1 && j === 0) return 1 + la * rho;
  if (i === 1 && j === 1) return 1 - rho;
  return 1;
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const round2 = (x) => Math.round(x * 100) / 100;
// Real team (not a knockout placeholder like 2A / W73 / L101).
const isReal = (n) => !!n && !/^(\d[A-L]|3[A-L/]+|[WL]\d+)$/.test(n);

// Build ratings. `priorOnly` ignores in-tournament results (used for an
// honest, leakage-free back-test of the prior's predictive power).
export function buildModel(matches, { priorOnly = false } = {}) {
  const finished = matches.filter((m) => m.score && m.score.home != null && m.status === "finished");
  let goals = 0, n = 0;
  for (const m of finished) { goals += m.score.home + m.score.away; n++; }
  const MU = n ? goals / (2 * n) : 1.35; // mean goals per team per match

  // Recency weighting (captures form/trends): a match counts more the closer it
  // is to the latest game played. Fixed half-life (theory-driven, not tuned to
  // the back-test → no overfitting). Gw = effective (weighted) games.
  const TAU_DAYS = 14;
  const dates = finished.map((m) => m.date).filter(Boolean).sort();
  const maxDate = dates[dates.length - 1];
  const weightOf = (m) => {
    if (!m.date || !maxDate) return 1;
    const days = (Date.parse(maxDate) - Date.parse(m.date)) / 86400000;
    return Number.isFinite(days) ? Math.exp(-days / TAU_DAYS) : 1;
  };

  const tally = new Map();
  const get = (name) => { if (!tally.has(name)) tally.set(name, { GF: 0, GA: 0, G: 0, Gw: 0 }); return tally.get(name); };
  if (!priorOnly) {
    for (const m of finished) {
      const w = weightOf(m);
      const h = get(m.home.name), a = get(m.away.name);
      h.GF += w * m.score.home; h.GA += w * m.score.away; h.G++; h.Gw += w;
      a.GF += w * m.score.away; a.GA += w * m.score.home; a.G++; a.Gw += w;
    }
  }

  const teams = new Set();
  for (const m of matches) {
    if (isReal(m.home?.name)) teams.add(m.home.name);
    if (isReal(m.away?.name)) teams.add(m.away.name);
  }
  const elos = [...teams].map((t) => ELO[t] ?? DEFAULT_ELO);
  const avgElo = elos.length ? elos.reduce((s, x) => s + x, 0) / elos.length : 1700;

  const ratings = new Map();
  for (const name of teams) {
    const t = tally.get(name) || { GF: 0, GA: 0, G: 0, Gw: 0 };
    const elo = ELO[name] ?? DEFAULT_ELO;
    const f = Math.pow(10, (elo - avgElo) / 400);       // strength multiplier vs field
    const priorAtt = MU * Math.sqrt(f);                 // strong → score more
    const priorDef = MU / Math.sqrt(f);                 // strong → concede less
    // Shrink the (recency-weighted) form toward the Elo prior.
    const att = (t.GF + K_SHRINK * priorAtt) / (t.Gw + K_SHRINK);
    const def = (t.GA + K_SHRINK * priorDef) / (t.Gw + K_SHRINK);
    ratings.set(name, { name, elo, games: t.G, att: round2(att), def: round2(def) });
  }
  return { MU: round2(MU), ratings, finished: finished.length, avgElo: Math.round(avgElo) };
}

// Predict one fixture → probabilities, most-likely scoreline, expected goals.
// In knockout ties there are no draws: the 90' draw mass resolves in extra time
// (proportional to attacking strength) and penalties (team shootout rating), so
// we also return who ADVANCES and the chance it goes to a shootout.
export function predict(home, away, model, { knockout = false } = {}) {
  const rh = model.ratings.get(home), ra = model.ratings.get(away);
  if (!rh || !ra) return null;
  const homeAdv = !knockout && HOSTS.has(home) ? HOME_ADV : 1;
  const lh = clamp(rh.att * (ra.def / model.MU) * homeAdv, 0.15, 5.5);
  const la = clamp(ra.att * (rh.def / model.MU), 0.15, 5.5);

  let pH = 0, pD = 0, pA = 0, best = { p: -1, i: 0, j: 0 };
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = pois(i, lh) * pois(j, la) * dc(i, j, lh, la, DC_RHO);
      if (i > j) pH += p; else if (i === j) pD += p; else pA += p;
      if (p > best.p) best = { p, i, j };
    }
  }
  const Z = pH + pD + pA;
  const out = {
    home, away,
    expHome: round2(lh), expAway: round2(la),
    probs: { home: pH / Z, draw: pD / Z, away: pA / Z },
    scoreline: `${best.i}–${best.j}`,
    confidence: Math.max(pH, pD, pA) / Z,
    knockout,
  };
  if (!knockout) return out;

  // No draws: split the draw mass between extra time (by attacking edge) and
  // penalties (by shootout rating). ~55% of level games are decided in ET.
  const drawP = pD / Z;
  const etShare = 0.55, penShare = 0.45;
  const etHome = lh / (lh + la);                       // ET: stronger attack tends to score
  const penH = PEN[home] ?? DEFAULT_PEN, penA = PEN[away] ?? DEFAULT_PEN;
  const shootHome = penH / (penH + penA);              // P(home wins a shootout)
  const advHome = pH / Z + drawP * (etShare * etHome + penShare * shootHome);
  const advAway = pA / Z + drawP * (etShare * (1 - etHome) + penShare * (1 - shootHome));
  const s = advHome + advAway || 1;
  out.advance = { home: advHome / s, away: advAway / s };
  out.penaltyProb = drawP * penShare;                  // chance it reaches a shootout
  out.shootout = { home: round2(shootHome), away: round2(1 - shootHome) };
  return out;
}

// A fixture is "confirmed" for prediction when both sides are real teams
// (placeholder codes like 2A / W73 aren't in the ratings map).
export function upcomingPredictions(matches, model, limit = 16) {
  return matches
    .filter((m) => m.status === "scheduled" && model.ratings.has(m.home?.name) && model.ratings.has(m.away?.name))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .slice(0, limit)
    .map((m) => ({ match: m, prediction: predict(m.home.name, m.away.name, model, { knockout: m.stage === "knockout" }) }))
    .filter((x) => x.prediction);
}

// ---- back-test: how good is the model on already-played matches? ----
// Walk-forward (the honest way): predict each match using ONLY the matches
// played BEFORE it — zero look-ahead, exactly what you could have known at
// kickoff. Early games lean on the Elo prior; later ones blend in form. We
// score with proper metrics (Brier, RPS, log-loss) and compare to naive
// baselines, so we never fool ourselves with in-sample numbers (overfitting).
export function backtest(matches) {
  const finished = matches
    .filter((m) => m.score && m.score.home != null && m.status === "finished" && isReal(m.home?.name) && isReal(m.away?.name))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const outcome = (h, a) => (h > a ? "home" : h < a ? "away" : "draw");

  let n = 0, hit = 0, exact = 0, brier = 0, rps = 0, logloss = 0;
  let baseRps = 0, baseHit = 0; // uniform 1/3 baseline + "home always"
  const order = ["home", "draw", "away"];
  const samples = []; // per-match predicted vs actual, for the "report card" UI
  for (let idx = 0; idx < finished.length; idx++) {
    const m = finished[idx];
    // Train on strictly-earlier matches only: keep results for the first `idx`
    // played games, mask everything else to "scheduled" (team membership stays,
    // results don't leak from the future).
    const pastIds = new Set(finished.slice(0, idx).map((x) => x.id));
    const trainSet = matches.map((x) => (pastIds.has(x.id) ? x : { ...x, status: "scheduled", score: null }));
    const model = buildModel(trainSet);
    const p = predict(m.home.name, m.away.name, model);
    if (!p) continue;
    n++;
    const act = outcome(m.score.home, m.score.away);
    const y = { home: act === "home" ? 1 : 0, draw: act === "draw" ? 1 : 0, away: act === "away" ? 1 : 0 };
    const pred = order.reduce((b, k) => (p.probs[k] > p.probs[b] ? k : b), "home");
    const exactHit = p.scoreline === `${m.score.home}–${m.score.away}`;
    if (pred === act) hit++;
    if (exactHit) exact++;
    samples.push({
      match: m, predOutcome: pred, actOutcome: act, correct: pred === act,
      exact: exactHit, predScore: p.scoreline, actScore: `${m.score.home}–${m.score.away}`,
      probs: p.probs, confidence: p.confidence,
    });
    for (const k of order) brier += (p.probs[k] - y[k]) ** 2;
    logloss += -Math.log(Math.max(1e-9, p.probs[act]));
    // RPS (ordered home>draw>away): mean of squared cumulative diffs
    let cP = 0, cY = 0, r = 0;
    for (let i = 0; i < order.length - 1; i++) { cP += p.probs[order[i]]; cY += y[order[i]]; r += (cP - cY) ** 2; }
    rps += r / (order.length - 1);
    // baselines
    let bcP = 0, bcY = 0, br = 0;
    for (let i = 0; i < order.length - 1; i++) { bcP += 1 / 3; bcY += y[order[i]]; br += (bcP - bcY) ** 2; }
    baseRps += br / (order.length - 1);
    if (act === "home") baseHit++; // "home wins" naive accuracy
  }
  const safe = (x) => (n ? round2(x / n) : 0);
  const accuracy = n ? hit / n : 0;
  const rpsMean = n ? rps / n : 0, baseRpsMean = n ? baseRps / n : 0;
  const skill = baseRpsMean ? 1 - rpsMean / baseRpsMean : 0; // >0 means better than guessing
  return {
    n, accuracy: round2(accuracy), exactScore: round2(n ? exact / n : 0),
    brier: safe(brier), logloss: safe(logloss), rps: round2(rpsMean),
    baselineRps: round2(baseRpsMean), baselineAccuracy: round2(n ? baseHit / n : 0),
    skillVsUniform: round2(skill),
    confidence: confidenceLabel(n, skill, accuracy),
    samples, // chronological; UI shows the most recent
  };
}

// Returns a key; the UI translates it (pred.cf.*).
function confidenceLabel(n, skill, acc) {
  if (n < 6) return "low";              // too few games to judge
  if (skill > 0.10 && acc > 0.5) return "modhigh";
  if (skill > 0.03) return "mod";
  if (skill > 0) return "lowmod";
  return "low";
}
