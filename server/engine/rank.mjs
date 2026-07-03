// Pure ranking — safe to import from cloud functions (no node:fs).
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
