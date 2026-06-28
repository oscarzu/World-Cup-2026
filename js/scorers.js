// scorers.js — aggregate top scorers from goal events.

// Returns array of { name, country, goals, penalties, assists, minutesPlayed }
// sorted by FIFA's Golden Boot criteria:
//   1) most goals  2) most assists  3) fewest minutes played
// Assists/minutes are used when the data layer provides them; otherwise we fall
// back to fewer penalty goals (open-play preference) and then name, so the order
// is as precise as the available data allows.
export function computeScorers(matches) {
  const tally = new Map();

  for (const m of matches) {
    for (const g of m.goals || []) {
      if (!g.name) continue;
      // Skip own goals if ever annotated.
      if (/own goal/i.test(g.name)) continue;
      const country = g.team === "home" ? m.home.name : m.away.name;
      const key = `${g.name}__${country}`;
      if (!tally.has(key)) tally.set(key, { name: g.name, country, goals: 0, penalties: 0, assists: 0, minutesPlayed: null });
      const t = tally.get(key);
      t.goals++;
      if (g.penalty) t.penalties++;
      if (g.assist) t.assists++; // counted if the provider tags assists
    }
    // Optional assist credit from a dedicated assists array (future-proof).
    for (const a of m.assists || []) {
      const country = a.team === "home" ? m.home.name : m.away.name;
      const t = tally.get(`${a.name}__${country}`);
      if (t) t.assists++;
    }
  }

  const mins = (x) => (x.minutesPlayed == null ? Infinity : x.minutesPlayed);
  return [...tally.values()].sort(
    (a, b) =>
      b.goals - a.goals ||           // 1) most goals
      b.assists - a.assists ||       // 2) most assists
      mins(a) - mins(b) ||           // 3) fewest minutes played
      a.penalties - b.penalties ||   // fallback: prefer open-play goals
      a.name.localeCompare(b.name)
  );
}

// Knockout rounds in bracket order, for the per-phase goal breakdown.
const KO_ROUND_ORDER = ["Round of 32", "Round of 16", "Quarter-final", "Semi-final", "Match for third place", "Final"];

// Quick tournament-wide goal stats for the charts/overview.
export function goalStats(matches) {
  let goals = 0, played = 0;
  const byMatchday = new Map();
  const byGroup = new Map();
  let groupGoals = 0, groupPlayed = 0;        // whole group-stage totals
  const koGoals = new Map();                   // knockout goals per round

  for (const m of matches) {
    if (!m.score || m.score.home == null || m.status !== "finished") continue;
    played++;
    const g = m.score.home + m.score.away;
    goals += g;
    if (m.matchday != null) byMatchday.set(m.matchday, (byMatchday.get(m.matchday) || 0) + g);
    if (m.group) byGroup.set(m.group, (byGroup.get(m.group) || 0) + g);
    if (m.stage === "knockout") koGoals.set(m.round, (koGoals.get(m.round) || 0) + g);
    else { groupGoals += g; groupPlayed++; }
  }
  // Goals by phase: one bucket for the whole group stage, then one per knockout
  // round actually played (in bracket order). Each entry: { key, goals, stage }.
  const byPhase = [];
  if (groupPlayed) byPhase.push({ key: "group", goals: groupGoals, stage: "group" });
  for (const round of KO_ROUND_ORDER) {
    if (koGoals.has(round)) byPhase.push({ key: round, goals: koGoals.get(round), stage: "knockout" });
  }
  return {
    goals, played,
    avg: played ? goals / played : 0,
    byMatchday: [...byMatchday.entries()].sort((a, b) => a[0] - b[0]),
    byGroup: [...byGroup.entries()].sort(),
    byPhase,
  };
}

// Per-scorer goal log: who they scored against, when, and whether it was a
// penalty. Keyed like computeScorers ("name__country"). Powers the scorer
// drill-down ("show against which teams they scored").
export function goalsByScorer(matches) {
  const map = new Map();
  for (const m of matches) {
    for (const g of m.goals || []) {
      if (!g.name || /own goal/i.test(g.name)) continue;
      const scoredFor = g.team === "home" ? m.home.name : m.away.name;
      const opponent = g.team === "home" ? m.away.name : m.home.name;
      const key = `${g.name}__${scoredFor}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ opponent, minute: g.minute ?? null, penalty: !!g.penalty, round: m.round, date: m.date });
    }
  }
  // Sort each player's goals chronologically by minute within the tournament.
  for (const arr of map.values()) arr.sort((a, b) => (a.date || "").localeCompare(b.date || "") || (Number(a.minute) || 0) - (Number(b.minute) || 0));
  return map;
}
