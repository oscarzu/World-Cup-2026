// scorers.js — aggregate top scorers from goal events.

// Returns array of { name, country, goals, penalties } sorted by goals desc.
export function computeScorers(matches) {
  const tally = new Map();

  for (const m of matches) {
    for (const g of m.goals || []) {
      if (!g.name) continue;
      // Skip own goals if ever annotated.
      if (/own goal/i.test(g.name)) continue;
      const country = g.team === "home" ? m.home.name : m.away.name;
      const key = `${g.name}__${country}`;
      if (!tally.has(key)) tally.set(key, { name: g.name, country, goals: 0, penalties: 0 });
      const t = tally.get(key);
      t.goals++;
      if (g.penalty) t.penalties++;
    }
  }

  return [...tally.values()].sort(
    (a, b) => b.goals - a.goals || a.name.localeCompare(b.name)
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
