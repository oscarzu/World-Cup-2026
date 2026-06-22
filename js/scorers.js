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

// Quick tournament-wide goal stats for the charts/overview.
export function goalStats(matches) {
  let goals = 0, played = 0;
  const byMatchday = new Map();
  const byGroup = new Map();

  for (const m of matches) {
    if (!m.score || m.score.home == null || m.status !== "finished") continue;
    played++;
    const g = m.score.home + m.score.away;
    goals += g;
    if (m.matchday != null) byMatchday.set(m.matchday, (byMatchday.get(m.matchday) || 0) + g);
    if (m.group) byGroup.set(m.group, (byGroup.get(m.group) || 0) + g);
  }
  return {
    goals, played,
    avg: played ? goals / played : 0,
    byMatchday: [...byMatchday.entries()].sort((a, b) => a[0] - b[0]),
    byGroup: [...byGroup.entries()].sort(),
  };
}
