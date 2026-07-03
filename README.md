# RUBRIC — the standard for agent-harness engineering

**Don't solve the problem. Engineer the agent that solves it.**

Everyone gets the same model. You compete on the **harness** — the prompt, control flow,
and self-repair you wrap around it. Submit a `solve(spec, llm)` function; it runs in a
**sandbox** against a **hidden benchmark**; you rank on **pass-rate, then efficiency**
(tokens → cost → latency). The leaderboard is the credential.

## The problem this solves

There is no LeetCode for agent engineers. Companies shipping agents have no standard signal
for "who can actually build a good harness," and no objective way to compare two harnesses on
the same task. Rubric is that standard: a fixed model, a hidden benchmark, and a deterministic
ranking that rewards correctness first and efficiency second.

## Why EdgeOne is load-bearing (not bolted on)

Running **untrusted harness code** against a benchmark is impossible without three things
Rubric gets directly from EdgeOne Makers:

| Need | EdgeOne primitive |
|---|---|
| Execute untrusted harness + candidate code safely | **Sandbox** |
| One model for everyone, with metered token/cost | **AI Gateway** (`AI_GATEWAY_*`) |
| Durable per-problem leaderboard | **`context.store`** |
| Judges use it live on their phone | **one-click deploy** |

## The demo thesis (provable in 20 seconds)

Same model, two harnesses:

| Harness | Score | Tokens | Why |
|---|---|---|---|
| **One-Shot** | 2/4 | 545 | one model call, ships the first (buggy) answer |
| **Self-Repair** | 4/4 | 910 | runs the public example, re-prompts on failure |

Better harness → higher score, at a measurable token cost. That's the entire pitch, and the
efficiency tiebreak is exactly what makes it a *standard* and not a vibes contest.

## Run locally (zero API keys)

```bash
npm install
npm run dev        # web on :5173, judge API on :8787
```

With no AI Gateway configured, a deterministic **mock model** stands in so the full
platform works offline. Point it at a real model by setting `AI_GATEWAY_BASE_URL` +
`AI_GATEWAY_API_KEY` (any OpenAI-compatible endpoint).

## Deploy to EdgeOne (hack-time)

```bash
npm i -g edgeone
edgeone makers dev       # local runtime + observability panel
edgeone makers deploy    # one-click production
```

`edgeone.json` declares the Vite frontend + the `judge` agent (`/agents/judge`).
On deploy, `AI_GATEWAY_*` are auto-injected, so `server/engine/llm.mjs` switches from
mock to the real gateway with no code change. The leaderboard persists via Blob storage
in `cloud-functions/leaderboard/` (not session memory).

## Layout

```
edgeone.json                 EdgeOne Makers config (Vite frontend + agents + cloud functions)
agents/judge/index.ts        Production judge (POST /judge, streams SSE)
cloud-functions/
  leaderboard/index.ts       GET/POST /leaderboard (Blob storage)
  problem/index.ts           GET /problem
server/
  dev-server.mjs             Local mirror of the judge for offline dev
  engine/
    runner.mjs               Run a submission across all tasks, meter usage, emit events
    codingBench.mjs          The benchmark: tasks + hidden tests
    sandbox.mjs              Run untrusted code (vm locally / EdgeOne sandbox in prod)
    llm.mjs                  Metered model client (AI Gateway or mock)
    store.mjs                Leaderboard persistence + the ranking function
    baselines.mjs            House harnesses (One-Shot, Self-Repair) + starter code
src/                         Graphite/Linear React frontend
```
