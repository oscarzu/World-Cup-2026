// qualification.js — derive the road to the Round of 32 from live standings:
// group winners, runners-up, the 8 best third-placed teams, and a simple
// "what-if" status per team for the final group matchday.
//
// Format 2026: 12 groups of 4. Top 2 of each group (24) + the 8 best
// third-placed teams = 32 to the Round of 32.

// A group is finished when all four teams have played their 3 games.
export function groupComplete(rows) {
  return rows && rows.length >= 4 && rows.every((r) => r.P >= 3);
}

// Rank the 12 third-placed teams by FIFA's criteria. The first 8 advance.
// Tiebreakers we can compute from results: points → goal difference → goals
// scored → (fair play / draw are not modelled). Returns rows tagged with group.
export function rankThirds(standings) {
  const thirds = [];
  for (const [g, rows] of standings) {
    if (rows[2]) thirds.push({ group: g.replace("Group ", ""), ...rows[2] });
  }
  thirds.sort((a, b) =>
    b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || a.name.localeCompare(b.name));
  return thirds.map((t, i) => ({ ...t, rank: i + 1, qualified: i < 8 }));
}

// Top-two status for a team, used as the "what-if" indicator for the last
// matchday. Deterministic once the group is complete; otherwise a projection.
//   "in"   — top-2 already secured
//   "live" — still in contention
//   "out"  — can no longer reach top 2 (may still chase a best-third spot)
export function teamTop2Status(rows, idx) {
  const t = rows[idx];
  if (groupComplete(rows)) return idx < 2 ? "in" : "out";
  const remT = 3 - t.P;
  const maxT = t.Pts + 3 * remT;
  let surelyAhead = 0; // teams already beyond T's best possible total
  let canBeAhead = 0;  // teams that could still finish above T's current total
  for (let j = 0; j < rows.length; j++) {
    if (j === idx) continue;
    const o = rows[j];
    if (o.Pts > maxT) surelyAhead++;
    const maxO = o.Pts + 3 * (3 - o.P);
    if (maxO > t.Pts) canBeAhead++;
  }
  if (surelyAhead >= 2) return "out";   // at least 2 teams out of reach
  if (canBeAhead <= 1) return "in";     // at most 1 team can be above → top 2
  return "live";
}

// Whole-bracket projection: winners, runners-up and ranked thirds.
export function qualification(standings) {
  const groups = [...standings.entries()]; // already sorted A..L
  const winners = groups.map(([g, r]) => ({ group: g.replace("Group ", ""), row: r[0], done: groupComplete(r) }));
  const runners = groups.map(([g, r]) => ({ group: g.replace("Group ", ""), row: r[1], done: groupComplete(r) }));
  const thirds = rankThirds(standings);
  const allDone = groups.length === 12 && groups.every(([, r]) => groupComplete(r));
  return { winners, runners, thirds, allDone, groups };
}
