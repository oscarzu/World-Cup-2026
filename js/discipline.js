// discipline.js — fouls (per match), shooting efficacy (conversion %),
// red cards and serious injuries, from the curated/real team-stats layer.

import { teamES } from "./config.js";

export function computeDiscipline(teamStats, matchesByTeam = {}) {
  const teams = teamStats?.teams || {};
  const entries = Object.entries(teams);

  const matchesOf = (name, s) =>
    Math.max(1, s.matches ?? matchesByTeam[teamES(name)] ?? matchesByTeam[name] ?? 1);

  // Fouls per match (normalised — avoids bias from teams that played more games).
  const foulsRanking = entries
    .map(([name, s]) => {
      const m = matchesOf(name, s);
      return { name, fouls: s.fouls ?? 0, matches: m, perMatch: (s.fouls ?? 0) / m };
    })
    .sort((a, b) => b.perMatch - a.perMatch);

  // Efficacy = conversion %: goals ÷ shots on target × 100. Higher = more efficient.
  const efficacy = entries
    .filter(([, s]) => (s.shotsOnTarget ?? 0) > 0)
    .map(([name, s]) => ({
      name, shots: s.shotsOnTarget, goals: s.goals ?? 0,
      pct: ((s.goals ?? 0) / s.shotsOnTarget) * 100,
    }))
    .sort((a, b) => b.pct - a.pct);            // best (highest %) first

  const yellow = [...(teamStats?.yellowCards || [])]
    .sort((a, b) => b.cards - a.cards).slice(0, 10);

  // Red cards by selección (desc). Prefer real ESPN counts (s.red) over curated.
  const redByTeam = entries
    .map(([name, s]) => ({ name, red: s.red ?? s.redCards ?? 0 }))
    .filter((x) => x.red > 0)
    .sort((a, b) => b.red - a.red);
  const redTotal = redByTeam.some((x) => x.red)
    ? redByTeam.reduce((n, x) => n + x.red, 0)
    : (teamStats?.redCardsTotal ?? 0);

  const injuries = teamStats?.seriousInjuries || [];

  return {
    foulsRanking,
    mostFouls: foulsRanking[0] || null,
    efficacy,                                  // best → worst (pct desc)
    mostEfficacy: efficacy[0] || null,         // highest conversion %
    leastEfficacy: efficacy[efficacy.length - 1] || null, // lowest conversion %
    yellow,
    redByTeam, redTotal,
    injuries,
  };
}
