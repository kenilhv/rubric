import type { TaskSpec, TaskResult } from "../types";

export type RunStatus = "pending" | "running" | "pass" | "fail" | "error";
export type RunState = {
  phase: "idle" | "running" | "done";
  statuses: Record<string, { status: RunStatus } & Partial<TaskResult>>;
  summary: { score: number; total: number; tokens: number; cost: number; latency: number } | null;
  model?: string;
};

const glyph: Record<RunStatus, string> = { pending: "", running: "", pass: "✓", fail: "✕", error: "!" };

export function RunPanel({ tasks, run }: { tasks: TaskSpec[]; run: RunState }) {
  if (run.phase === "idle") {
    return <div className="run-empty">submit a harness to run it against the hidden benchmark</div>;
  }
  return (
    <div className="run">
      {tasks.map((t) => {
        const s = run.statuses[t.id]?.status ?? "pending";
        const r = run.statuses[t.id];
        const rowCls = s === "running" ? "active-row" : ["pass", "fail", "error"].includes(s) ? `done ${s}` : "";
        return (
          <div key={t.id} className={`run-task ${rowCls}`}>
            <span className={`status-dot ${s}`}>{glyph[s]}</span>
            <div>
              <div className="title">{t.title}</div>
              {r?.detail && <div className="detail">{r.detail}</div>}
            </div>
            {r && (r.tokens != null) && (
              <div className="rt-meta">
                {r.calls}× · {r.tokens} tok
              </div>
            )}
          </div>
        );
      })}

      {run.summary && (
        <div className="run-summary">
          <div className="stat">
            <div className="n accent">
              {run.summary.score}/{run.summary.total}
            </div>
            <div className="k">passed</div>
          </div>
          <div className="stat">
            <div className="n">{run.summary.tokens.toLocaleString()}</div>
            <div className="k">tokens</div>
          </div>
          <div className="stat">
            <div className="n">${run.summary.cost.toFixed(4)}</div>
            <div className="k">cost</div>
          </div>
          <div className="stat">
            <div className="n">{(run.summary.latency / 1000).toFixed(1)}s</div>
            <div className="k">latency</div>
          </div>
        </div>
      )}
    </div>
  );
}
