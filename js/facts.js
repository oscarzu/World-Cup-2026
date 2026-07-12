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
  // Match lists behind each stat, so a card/bar can drill into "which games".
  const lists = { comebacks: [], shootouts: [], cleanSheets: [], blowouts: [], zeroZero: [], penaltyGoals: [] };

  for (const m of finished) {
    const h = m.score.home, a = m.score.away;
    const total = h + a;
    totalGoals += total;

    if (total === 0) { zeroZero++; lists.zeroZero.push(m); }
    if (m.score.penHome != null) { shootouts++; lists.shootouts.push(m); }
    if (h === 0 || a === 0) { cleanSheets++; lists.cleanSheets.push(m); }

    const margin = Math.abs(h - a);
    if (margin >= 3) { blowouts++; lists.blowouts.push(m); }
    if (!biggest || margin > biggest.margin)
      biggest = { m, margin, score: `${h}–${a}` };
    if (!highest || total > highest.total)
      highest = { m, total, score: `${h}–${a}` };

    teamGoals.set(m.home.name, (teamGoals.get(m.home.name) || 0) + h);
    teamGoals.set(m.away.name, (teamGoals.get(m.away.name) || 0) + a);

    // Half-time comeback: a side losing at the break ends up winning.
    const hh = m.score.htHome, ha = m.score.htAway;
    if (hh != null && ha != null) {
      if ((hh < ha && h > a) || (ha < hh && a > h)) { comebacks++; lists.comebacks.push(m); }
    }

    // Per-match goal tally for hat-tricks + earliest/latest goal of the cup.
    const tally = new Map();
    let matchHasPen = false;
    for (const g of m.goals || []) {
      if (g.penalty) { penaltyGoals++; matchHasPen = true; }
      const min = num(g.minute);
      if (min != null) {
        if (!fastest || min < fastest.min) fastest = { min, name: g.name, m };
        if (!latest || min > latest.min) latest = { min, name: g.name, m };
      }
      if (g.name && !/own goal/i.test(g.name))
        tally.set(g.name, (tally.get(g.name) || 0) + 1);
    }
    if (matchHasPen) lists.penaltyGoals.push(m);
    for (const [name, n] of tally) if (n >= 3) hatTricks.push({ name, n, m });
  }

  const topTeams = [...teamGoals.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 8)
    .map(([name, goals]) => ({ name, goals }));

  // Attendance: prefer the sum of real per-match figures as events happen;
  // if no match reports a real attendance yet, fall back to a whole-tournament
  // estimate (clearly flagged as such in the UI).
  const withAtt = finished.filter((m) => m.attendance != null);
  const realAttendance = withAtt.reduce((s, m) => s + m.attendance, 0);
  const attendanceInfo = withAtt.length
    ? { total: realAttendance, matches: withAtt.length, isEstimate: false }
    : { total: CONFIG.TOURNAMENT.aggregates.attendance, matches: 0, isEstimate: true };

  return {
    played: finished.length,
    totalGoals,
    avg: finished.length ? totalGoals / finished.length : 0,
    penaltyGoals, zeroZero, shootouts, blowouts, comebacks, cleanSheets,
    hatTricks, biggest, highest, fastest, latest, topTeams,
    lists,
    aggregates: CONFIG.TOURNAMENT.aggregates,
    attendanceInfo,
    addedTime: CONFIG.TOURNAMENT.addedTime,
  };
}

// Penalty-shootout stats from knockout matches decided on penalties
// (score.penHome/penAway = pens scored by each side). Returns each shootout plus
// a per-team record (contested / won / lost / pens scored + conversion).
export function shootoutStats(matches) {
  const list = [];
  const byTeam = new Map();
  const bump = (name, won, scored) => {
    const r = byTeam.get(name) || { name, contested: 0, won: 0, lost: 0, scored: 0 };
    r.contested++; r[won ? "won" : "lost"]++; r.scored += scored;
    byTeam.set(name, r);
  };
  for (const m of matches) {
    const ph = m.score?.penHome, pa = m.score?.penAway;
    if (ph == null || pa == null || !m.home?.name || !m.away?.name) continue;
    const homeWon = ph > pa;
    // On-field score at the end of extra time (level), for context on the card.
    const level = m.score?.etHome != null ? `${m.score.etHome}-${m.score.etAway}` : `${m.score.home}-${m.score.away}`;
    list.push({ home: m.home.name, away: m.away.name, penHome: ph, penAway: pa,
      winner: homeWon ? m.home.name : m.away.name, round: m.round, level, date: m.date });
    bump(m.home.name, homeWon, ph);
    bump(m.away.name, !homeWon, pa);
  }
  list.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const teams = [...byTeam.values()].sort((a, b) => b.won - a.won || b.scored - a.scored || a.name.localeCompare(b.name));
  return { list, teams, total: list.length };
}
