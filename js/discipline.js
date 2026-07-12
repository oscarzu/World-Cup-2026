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

  // Goalkeeping / shot-stopping: save % = saves ÷ shots on target faced, where
  // saves ≈ shots on target faced − goals conceded (a shot on target that isn't
  // a goal was stopped). Needs the Worker's shotsFaced/against fields.
  const goalkeeping = entries
    .filter(([, s]) => (s.shotsFaced ?? 0) >= 3)
    .map(([name, s]) => {
      const faced = s.shotsFaced, against = s.against ?? 0;
      const saves = Math.max(0, faced - against);
      return { name, faced, saves, against, cleanSheets: s.cleanSheets ?? 0,
        matches: matchesOf(name, s), savePct: faced ? (saves / faced) * 100 : 0 };
    })
    .sort((a, b) => b.savePct - a.savePct || b.saves - a.saves);

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
    goalkeeping,                               // best shot-stoppers (save % desc)
    bestKeeper: goalkeeping[0] || null,
    yellow,
    redByTeam, redTotal,
    injuries,
  };
}
