// standings.js — compute group tables from finished/played matches.

// Returns a Map: groupName -> sorted array of team rows.
export function computeStandings(matches) {
  const groups = new Map();

  const row = (name) => ({
    name, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0,
  });

  for (const m of matches) {
    if (m.stage !== "group" || !m.group) continue;
    if (!groups.has(m.group)) groups.set(m.group, new Map());
    const table = groups.get(m.group);
    if (!table.has(m.home.name)) table.set(m.home.name, row(m.home.name));
    if (!table.has(m.away.name)) table.set(m.away.name, row(m.away.name));

    // Only count matches with a final score.
    const s = m.score;
    if (!s || s.home == null || s.away == null || m.status !== "finished") continue;

    const h = table.get(m.home.name);
    const a = table.get(m.away.name);
    h.P++; a.P++;
    h.GF += s.home; h.GA += s.away;
    a.GF += s.away; a.GA += s.home;
    if (s.home > s.away) { h.W++; a.L++; h.Pts += 3; }
    else if (s.home < s.away) { a.W++; h.L++; a.Pts += 3; }
    else { h.D++; a.D++; h.Pts += 1; a.Pts += 1; }
  }

  const out = new Map();
  for (const [g, table] of [...groups.entries()].sort()) {
    const rows = [...table.values()];
    for (const r of rows) r.GD = r.GF - r.GA;
    // FIFA-style ordering: Pts -> GD -> GF -> name.
    rows.sort((x, y) =>
      y.Pts - x.Pts || y.GD - x.GD || y.GF - x.GF || x.name.localeCompare(y.name));
    out.set(g, rows);
  }
  return out;
}
