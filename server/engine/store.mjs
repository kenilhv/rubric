import { rank } from "./rank.mjs";

// Leaderboard persistence + ranking. Locally this is a JSON file; on EdgeOne the
// leaderboard lives in a cloud function + Blob storage.
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
export { rank } from "./rank.mjs";

export function addRow(row) {
  const rows = loadRows();
  rows.push({ id: Math.random().toString(36).slice(2, 10), ...row });
  saveRows(rows);
  return rank(rows);
}

export function isEmpty() {
  return loadRows().length === 0;
}
