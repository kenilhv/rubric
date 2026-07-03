import type { Row } from "../types";

export function Leaderboard({ rows, youId }: { rows: Row[]; youId?: string }) {
  if (!rows.length) return <div className="spin-load">no submissions yet</div>;
  return (
    <table className="lb">
      <thead>
        <tr>
          <th className="l rank">#</th>
          <th className="l">Harness</th>
          <th>Score</th>
          <th>Tokens</th>
          <th>Cost</th>
          <th>Latency</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const isYou = youId && r.id === youId;
          return (
            <tr key={r.id || r.name} className={`${r.rank === 1 ? "top" : ""} ${isYou ? "you flash" : ""}`}>
              <td className="l rank">{r.rank}</td>
              <td className="l name">{r.name}</td>
              <td className="score">
                <b>{r.score}</b>/{r.total}
              </td>
              <td>{r.tokens.toLocaleString()}</td>
              <td>${r.cost_usd.toFixed(4)}</td>
              <td>{(r.latency_ms / 1000).toFixed(1)}s</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
