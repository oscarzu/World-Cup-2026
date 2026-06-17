// facts.js — derive fun / "bizarre" tournament insights from the match results,
// and surface the curated tournament aggregates (offsides, cards, VAR, …).

import { CONFIG } from "./config.js";

const num = (v) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};

// Compute a rich set of derived facts from finished matches.
export function computeFacts(matches) {
  const finished = matches.filter(
    (m) => m.score && m.score.home != null && m.status === "finished"
  );

  let totalGoals = 0, penaltyGoals = 0, zeroZero = 0, shootouts = 0;
  let blowouts = 0, comebacks = 0, cleanSheets = 0;
  let biggest = null, highest = null, fastest = null, latest = null;
  const hatTricks = [];
  const teamGoals = new Map();

  for (const m of finished) {
    const h = m.score.home, a = m.score.away;
    const total = h + a;
    totalGoals += total;

    if (total === 0) zeroZero++;
    if (m.score.penHome != null) shootouts++;
    if (h === 0 || a === 0) cleanSheets++;

    const margin = Math.abs(h - a);
    if (margin >= 3) blowouts++;
    if (!biggest || margin > biggest.margin)
      biggest = { m, margin, score: `${h}–${a}` };
    if (!highest || total > highest.total)
      highest = { m, total, score: `${h}–${a}` };

    teamGoals.set(m.home.name, (teamGoals.get(m.home.name) || 0) + h);
    teamGoals.set(m.away.name, (teamGoals.get(m.away.name) || 0) + a);

    // Half-time comeback: a side losing at the break ends up winning.
    const hh = m.score.htHome, ha = m.score.htAway;
    if (hh != null && ha != null) {
      if ((hh < ha && h > a) || (ha < hh && a > h)) comebacks++;
    }

    // Per-match goal tally for hat-tricks + earliest/latest goal of the cup.
    const tally = new Map();
    for (const g of m.goals || []) {
      if (g.penalty) penaltyGoals++;
      const min = num(g.minute);
      if (min != null) {
        if (!fastest || min < fastest.min) fastest = { min, name: g.name, m };
        if (!latest || min > latest.min) latest = { min, name: g.name, m };
      }
      if (g.name && !/own goal/i.test(g.name))
        tally.set(g.name, (tally.get(g.name) || 0) + 1);
    }
    for (const [name, n] of tally) if (n >= 3) hatTricks.push({ name, n, m });
  }

  const topTeams = [...teamGoals.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 8)
    .map(([name, goals]) => ({ name, goals }));

  return {
    played: finished.length,
    totalGoals,
    avg: finished.length ? totalGoals / finished.length : 0,
    penaltyGoals, zeroZero, shootouts, blowouts, comebacks, cleanSheets,
    hatTricks, biggest, highest, fastest, latest, topTeams,
    aggregates: CONFIG.TOURNAMENT.aggregates,
  };
}
