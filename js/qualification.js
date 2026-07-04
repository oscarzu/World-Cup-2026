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

const isRealName = (n) => !!n && !/^(\d[A-L]|3[A-L/]+|[WL]\d+)$/.test(n);

// Resolve knockout placeholder codes (1A, 2B, 3A/B/C/D/F, W73) into real teams
// using the (complete) standings — openfootball often lags filling these, so we
// do it ourselves once the group stage is decided. Returns a NEW matches array
// with knockout home/away names resolved where possible. Best-third slots are a
// greedy projection (FIFA's official slotting table isn't modelled).
export function resolveKnockouts(matches, standings) {
  if (!standings || !standings.size) return matches;
  const thirds = rankThirds(standings).filter((t) => t.qualified && t.P > 0); // top 8
  const used = new Set();
  // Winners of already-played knockout matches (by match number). A level score
  // after extra time is decided by the penalty shootout (score.penHome/penAway).
  const winners = {};
  for (const m of matches) {
    const hs = m.score?.home, as = m.score?.away;
    if (hs == null || as == null || m.num == null) continue;
    const ph = m.score?.penHome, pa = m.score?.penAway;
    let side = hs > as ? "home" : as > hs ? "away"
      : (ph != null && pa != null ? (ph > pa ? "home" : pa > ph ? "away" : null) : null);
    const wName = side === "home" ? m.home?.name : side === "away" ? m.away?.name : null;
    if (wName && isRealName(wName)) winners[m.num] = wName;
  }
  const resolveCode = (code) => {
    if (isRealName(code)) return code;
    let mm = /^([12])([A-L])$/.exec(code);
    if (mm) { const rows = standings.get("Group " + mm[2]); const r = rows && rows[Number(mm[1]) - 1]; return r && r.P > 0 ? r.name : code; }
    if (/^3/.test(code)) {
      const groups = code.slice(1).split("/");
      for (const tr of thirds) { if (groups.includes(tr.group) && !used.has(tr.name)) { used.add(tr.name); return tr.name; } }
      return code;
    }
    mm = /^W(\d+)$/.exec(code);
    if (mm) return winners[mm[1]] || code;
    return code;
  };
  // Process knockout fixtures in match order so the greedy third assignment is
  // deterministic.
  const order = [...matches].sort((a, b) => (a.num ?? 0) - (b.num ?? 0));
  const resolved = new Map();
  for (const m of order) {
    if (m.stage !== "knockout") continue;
    resolved.set(m.id, { home: resolveCode(m.home?.name), away: resolveCode(m.away?.name) });
  }
  return matches.map((m) => {
    const r = resolved.get(m.id);
    if (!r) return m;
    return { ...m, home: { ...m.home, name: r.home }, away: { ...m.away, name: r.away } };
  });
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
