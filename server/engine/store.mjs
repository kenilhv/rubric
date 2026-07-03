// Leaderboard persistence + ranking. Locally this is a JSON file; on EdgeOne the
// same get/set map to context.store (see agents/judge/index.ts). Ranking is the
// standard itself: correctness first, then efficiency tiebreaks.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", ".data");
const file = join(dataDir, "leaderboard.json");

function ensure() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!existsSync(file)) writeFileSync(file, JSON.stringify({ rows: [] }, null, 2));
}

export function loadRows() {
  ensure();
  try {
    return JSON.parse(readFileSync(file, "utf8")).rows || [];
  } catch {
    return [];
  }
}

export function saveRows(rows) {
  ensure();
  writeFileSync(file, JSON.stringify({ rows }, null, 2));
}

// The ranking function — this is the "standard". Higher score wins; ties break on
// fewer tokens, then lower cost, then lower latency. Pure and deterministic.
export function rank(rows) {
  return [...rows]
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.tokens - b.tokens ||
        a.cost_usd - b.cost_usd ||
        a.latency_ms - b.latency_ms
    )
    .map((r, i) => ({ rank: i + 1, ...r }));
}

export function addRow(row) {
  const rows = loadRows();
  rows.push({ id: Math.random().toString(36).slice(2, 10), ...row });
  saveRows(rows);
  return rank(rows);
}

export function isEmpty() {
  return loadRows().length === 0;
}
