// discipline.js — derive fouls / shooting-efficacy / cards insights from the
// curated team-stats layer (data/teamstats.json).

export function computeDiscipline(teamStats) {
  const teams = teamStats?.teams || {};
  const entries = Object.entries(teams);

  // Fouls ranking (desc).
  const foulsRanking = entries
    .map(([name, s]) => ({ name, fouls: s.fouls ?? 0 }))
    .sort((a, b) => b.fouls - a.fouls);

  // Efficacy = shots on target ÷ goals. Higher ratio ⇒ worse finishing.
  const efficacy = entries
    .filter(([, s]) => (s.goals ?? 0) > 0 && (s.shotsOnTarget ?? 0) > 0)
    .map(([name, s]) => ({
      name, shots: s.shotsOnTarget, goals: s.goals,
      ratio: s.shotsOnTarget / s.goals,
    }))
    .sort((a, b) => b.ratio - a.ratio);

  const yellow = [...(teamStats?.yellowCards || [])]
    .sort((a, b) => b.cards - a.cards)
    .slice(0, 10);

  return {
    foulsRanking,
    mostFouls: foulsRanking[0] || null,
    leastEfficacy: efficacy[0] || null,
    mostEfficacy: efficacy[efficacy.length - 1] || null,
    yellow,
  };
}
