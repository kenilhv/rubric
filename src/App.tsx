import { useEffect, useMemo, useState } from "react";
import { getProblem, getLeaderboard, submitHarness, resetBoard } from "./api";
import type { ProblemPayload, Row } from "./types";
import { Leaderboard } from "./components/Leaderboard";
import { RunPanel, type RunState } from "./components/RunPanel";

const MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
  { id: "gpt-4o-mini", label: "GPT-4o mini" },
];

const IDLE: RunState = { phase: "idle", statuses: {}, summary: null };

export default function App() {
  const [problem, setProblem] = useState<ProblemPayload | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [source, setSource] = useState("");
  const [preset, setPreset] = useState<"starter" | "oneShot" | "selfRepair">("starter");
  const [run, setRun] = useState<RunState>(IDLE);
  const [youId, setYouId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProblem()
      .then((p) => {
        setProblem(p);
        setSource(p.presets.starter);
      })
      .catch((e) => setError(String(e.message || e)));
    getLeaderboard().then(setRows).catch(() => {});
  }, []);

  function loadPreset(key: "starter" | "oneShot" | "selfRepair") {
    if (!problem) return;
    setPreset(key);
    setSource(problem.presets[key]);
  }

  const running = run.phase === "running";

  async function onSubmit() {
    if (!problem || running) return;
    setError(null);
    setYouId(undefined);
    const statuses: RunState["statuses"] = {};
    problem.tasks.forEach((t) => (statuses[t.id] = { status: "pending" }));
    setRun({ phase: "running", statuses, summary: null, model });

    let doneAt: string | null = null;
    try {
      await submitHarness({ name: name.trim() || "anon", source, model }, (e) => {
        if (e.type === "task_start") {
          setRun((p) => ({ ...p, statuses: { ...p.statuses, [e.id]: { status: "running" } } }));
        } else if (e.type === "task_done") {
          setRun((p) => ({
            ...p,
            statuses: {
              ...p.statuses,
              [e.id]: { status: e.status, detail: e.detail, tokens: e.tokens, calls: e.calls },
            },
          }));
        } else if (e.type === "done") {
          doneAt = e.row.at ?? null;
          setRun((p) => ({
            ...p,
            phase: "done",
            model: e.row.model,
            summary: {
              score: e.row.score,
              total: e.row.total,
              tokens: e.row.tokens,
              cost: e.row.cost_usd,
              latency: e.row.latency_ms,
            },
          }));
        } else if (e.type === "leaderboard") {
          setRows(e.rows);
          const mine = e.rows.find((r) => r.at && r.at === doneAt);
          if (mine) setYouId(mine.id);
        } else if (e.type === "compile_error" || e.type === "fatal") {
          setError(e.error);
          setRun((p) => ({ ...p, phase: "idle" }));
        }
      });
    } catch (err: any) {
      setError(String(err?.message || err));
      setRun((p) => ({ ...p, phase: "idle" }));
    }
  }

  async function onReset() {
    const r = await resetBoard();
    setRows(r);
    setYouId(undefined);
    setRun(IDLE);
  }

  const topGap = useMemo(() => {
    const one = rows.find((r) => r.name === "One-Shot")?.score;
    const best = rows.find((r) => r.name === "Self-Repair")?.score;
    return one != null && best != null && one > 0 ? (best / one).toFixed(1) : null;
  }, [rows]);

  if (!problem) {
    return (
      <div className="app">
        {error ? <div className="err">{error}</div> : <div className="spin-load">loading rubric…</div>}
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="wordmark">
            RUBRIC<span className="dot">.</span>
          </span>
          <span className="tag">the standard for agent-harness engineering</span>
        </div>
        <div className="right">
          <span className="badge">{problem.problem.title}</span>
          <span className={`badge ${problem.live ? "live" : "mock"}`}>
            <span className="pip" />
            {problem.live ? "AI Gateway · live" : "mock model"}
          </span>
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow">competitive harness engineering</div>
        <h1 style={{ marginTop: 14 }}>
          Don't solve the problem. <em>Engineer the agent</em> that solves it.
        </h1>
        <p>
          Everyone gets the same model. You compete on the <b>harness</b> — the prompt, control flow, and
          self-repair you wrap around it. Submit a <code>solve()</code>, we run it in a sandbox against a hidden
          benchmark, and rank on pass-rate then efficiency. The leaderboard is the credential.
        </p>
        <div className="thesis">
          <span>
            <b>One-Shot</b> harness
          </span>
          <span className="arrow">→</span>
          <span>self-repair loop</span>
          <span className="arrow">→</span>
          <span>
            <b>{topGap ? `${topGap}× the score` : "higher score"}</b>, same model
          </span>
        </div>
      </section>

      <div className="grid">
        {/* LEFT */}
        <div>
          <div className="card">
            <div className="card-head">
              <h2>Problem · {problem.problem.title}</h2>
              <span className="eyebrow">{problem.tasks.length} tasks · hidden tests</span>
            </div>
            <div className="card-body">
              <div className="problem-statement">{problem.problem.statement}</div>
              <div className="tasklist">
                {problem.tasks.map((t) => (
                  <div className="taskrow" key={t.id}>
                    <span className="fn">{t.fnName}()</span>
                    <div className="meta">
                      <span className="hidden-count">{t.hiddenTestCount} hidden</span>
                      <span className={`diff ${t.difficulty}`}>{t.difficulty}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Your Harness</h2>
              <div className="editor-tabs">
                {(["starter", "oneShot", "selfRepair"] as const).map((k) => (
                  <button
                    key={k}
                    className={`chip ${preset === k ? "active" : ""}`}
                    onClick={() => loadPreset(k)}
                  >
                    {k === "starter" ? "Starter" : k === "oneShot" ? "One-Shot" : "Self-Repair"}
                  </button>
                ))}
              </div>
            </div>
            <div className="card-body">
              <div className="field-row">
                <label className="field">
                  <span>harness name</span>
                  <input
                    value={name}
                    placeholder="e.g. vote-of-3"
                    onChange={(e) => setName(e.target.value)}
                    maxLength={40}
                  />
                </label>
                <label className="field">
                  <span>model</span>
                  <select value={model} onChange={(e) => setModel(e.target.value)}>
                    {MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="editor-wrap">
                <textarea
                  className="editor"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  spellCheck={false}
                />
              </div>
              {error && <div className="err">{error}</div>}
              <div className="actions">
                <button className="primary" onClick={onSubmit} disabled={running || !source.trim()}>
                  {running ? "Running…" : "Submit & Run"}
                </button>
                <button className="ghost" onClick={onReset} disabled={running}>
                  Reset board
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div>
          <div className="card">
            <div className="card-head">
              <h2>Run</h2>
              <span className="eyebrow">{run.model || model} · sandbox</span>
            </div>
            <div className="card-body">
              <RunPanel tasks={problem.tasks} run={run} />
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Leaderboard</h2>
              <span className="eyebrow">score · then efficiency</span>
            </div>
            <div className="card-body" style={{ padding: "4px 8px 8px" }}>
              <Leaderboard rows={rows} youId={youId} />
            </div>
          </div>
        </div>
      </div>

      <footer className="foot">
        <span>
          Ranking: correctness → tokens → cost → latency. Untrusted harnesses run sandboxed; usage metered
          per submission.
        </span>
        <span className="stack">EdgeOne · Sandbox + AI Gateway + Blob storage</span>
      </footer>
    </div>
  );
}
