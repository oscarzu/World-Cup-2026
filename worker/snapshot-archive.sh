#!/usr/bin/env bash
# Freeze the Worker's captured dataset into the repo for good.
#
# The live match RESULTS are already frozen (data/worldcup.json, from openfootball).
# What only the Worker holds is the dataset we accumulated over the tournament:
# fouls, shots on target, yellow/red cards, real per-phase efficacy, and the
# measured added (stoppage) time. Run this ONCE after the final so those numbers
# live in the repo and power the archived site with zero API calls.
#
# Usage:  bash worker/snapshot-archive.sh
set -euo pipefail

WORKER="https://wc26-football-proxy.oscarzu.workers.dev"
OUT="data/archive"
mkdir -p "$OUT"

echo "Snapshotting $WORKER → $OUT/ ..."
curl -fsS "$WORKER/teamstats"     -o "$OUT/wc2026-teamstats.json"     && echo "  ✓ teamstats (fouls/shots/cards/addedTime)"
curl -fsS "$WORKER/efficacy.json" -o "$OUT/wc2026-efficacy.json"      && echo "  ✓ efficacy (real conversion per phase)"
curl -fsS "$WORKER/snapshot"      -o "$OUT/wc2026-snapshot.json"      && echo "  ✓ snapshot (last live state)"

# Promote the captured stats to the files the site reads, so the archived
# (offline) build shows the real accumulated numbers instead of the seed data.
cp "$OUT/wc2026-teamstats.json" data/teamstats.json && echo "  ✓ data/teamstats.json updated from capture"

echo "Done. Review the diff, then commit data/ and you can retire the Worker cron:"
echo "    cd worker && npx wrangler triggers deploy --triggers ''   # or delete the Worker"
