# RUBRIC — State, Architecture & Winning Playbook

> **Purpose of this file:** complete handoff state. Any human or AI (Cursor, Codex, Claude)
> should be able to pick up from here and finish the job. Last updated: 2026-07-03, morning
> before the Agent Forge Mini Hackathon (hacking window 3:00–4:00 PM, demo 4:00 PM).

---

## 1. What Rubric is (the idea, in three sentences)

**Rubric is LeetCode for agent-harness engineering.** Everyone gets the same model; you compete
on the *harness* — the prompt, control flow, self-testing, and repair logic you wrap around it.
Submissions run in a sandbox against a hidden benchmark and rank on **pass-rate, then efficiency
(tokens → cost → latency)** — a deterministic standard, which is exactly what companies lack when
hiring or evaluating agent engineers.

**The real pain:** every team shipping agents hand-rolls private evals. There is no shared,
objective, anti-gameable signal for "this person/harness is good at making models reliable."
LeetCode standardized coding interviews; nothing has standardized harness engineering. Judges
should hear: *the model is a commodity — the harness is the skill — Rubric measures the skill.*

**The provable thesis (already working):** same model, two harnesses:
- `One-Shot` (single call) → **2/4 tasks, 545 tokens**
- `Self-Repair` (runs public example, re-prompts on failure) → **4/4 tasks, 910 tokens**

Better engineering → higher score, at a measured token cost. Demo this in 20 seconds.

---

## 2. Current state — what is DONE and VERIFIED

Everything below runs locally with **zero API keys** (deterministic mock model) and was
verified end-to-end in the browser (submit → live run animation → leaderboard re-rank).

| Piece | File(s) | Status |
|---|---|---|
| Benchmark (4 coding tasks + hidden tests) | `server/engine/codingBench.mjs` | ✅ working |
| Runner (orchestrates run, meters usage, emits events) | `server/engine/runner.mjs` | ✅ working |
| Sandbox (compiles harness, runs candidate code, timeouts) | `server/engine/sandbox.mjs` | ✅ working (local `node:vm`) |
| Metered LLM (AI Gateway if env set, else mock) | `server/engine/llm.mjs` | ✅ working (mock path tested) |
| Mock model (imperfect on purpose — self-repair matters) | `server/engine/mockModel.mjs` | ✅ working |
| Leaderboard store + ranking | `server/engine/store.mjs` | ✅ working (local JSON) |
| Baseline harnesses (One-Shot, Self-Repair) + starter | `server/engine/harnesses/`, `baselines.mjs` | ✅ working, seed on boot |
| Local dev API (mirrors the judge) | `server/dev-server.mjs` | ✅ working (`:8787`) |
| Frontend (graphite/Linear, live run panel, leaderboard) | `src/` | ✅ working (`:5173`) |
| EdgeOne agent endpoint | `agents/judge/index.ts` | ⚠️ **WRITTEN TO A GUESSED API — MUST BE PORTED (see §4)** |
| Git repo | local `main`, commit `2c93c79` | ✅ committed, ❌ **not pushed yet** |
| EdgeOne deploy | — | ❌ not done (CLI not installed/logged in here) |

Run locally: `npm install && npm run dev` → web on 5173, judge API on 8787.
(`scripts/dev.sh` wraps this for environments with minimal PATH; Node on THIS machine is
user-local at `~/node/bin` — Guest account, no admin.)

**Official EdgeOne skills are installed** in `.claude/skills/` and `.agents/skills/`
(`edgeone-makers-agents`, `edgeone-makers-storage`, `edgeone-makers-deploy`, `makers-cli`,
`makers-cloud-functions`, …). Cursor picks these up too. **Consult `edgeone-makers-agents`
before touching `agents/`** — it contains the red lines summarized in §4.

---

## 3. Target architecture on EdgeOne (the winning shape)

```
rubric/
├── edgeone.json                  # Makers config (frontend + agent framework)
├── agents/
│   └── judge/
│       ├── index.ts              # POST /judge — runs a submission, streams SSE
│       └── stop.ts               # optional: cancel long runs (nice-to-have)
├── cloud-functions/
│   └── leaderboard/
│       └── index.ts              # GET/POST leaderboard — Blob storage (setJSON/getJSON)
├── server/                       # local dev mirror (KEEP — offline fallback demo)
│   ├── dev-server.mjs
│   └── engine/                   # shared brains — imported by BOTH dev server and agent
└── src/                          # React frontend (graphite/Linear)
```

**EdgeOne primitives used (this is the sponsor-usage story — make every one real):**
1. **Agent runtime** — `agents/judge` executes competitor harnesses
2. **AI Gateway** — every model call, metered, via `context.env.AI_GATEWAY_*` (auto-injected)
3. **Sandbox** — `context.sandbox.runCode(...)` executes untrusted candidate solutions
4. **Blob storage** — durable leaderboard via cloud function
5. **One-click deploy** — judges submit from their phones on the live URL
6. **Observability** — show the trace panel from `edgeone makers dev` during the demo

---

## 4. ⚠️ CRITICAL: porting `agents/judge/index.ts` to the real EdgeOne runtime

The current file uses a guessed API. Verified corrections from the official
`edgeone-makers-agents` skill (read it in `.claude/skills/edgeone-makers-agents/SKILL.md`):

| Current (WRONG for EdgeOne) | Required by EdgeOne runtime |
|---|---|
| `export default async function handler(request, context)` | `export async function onRequest(context)` |
| `await request.json()` | `context.request.body` (already parsed) |
| `request.headers.get('x')` | `context.request.headers['x']` (plain object) |
| `process.env.AI_GATEWAY_API_KEY` | `context.env.AI_GATEWAY_API_KEY` (`process.env` is BANNED in `agents/` and `cloud-functions/`) |
| Route `/agents/judge` | File routing: `agents/judge/index.ts` → **`POST /judge`** |
| NDJSON streaming | SSE: `data: {...}\n\n` events, `ping` heartbeat every 5s, headers `X-Accel-Buffering: no`, `Cache-Control: no-cache`, end with `data: [DONE]\n\n` |
| Leaderboard in `context.store` | **NO** — `context.store` is per-conversation session memory. Leaderboard = cloud function + Blob (`@edgeone/pages-blob`, `setJSON`/`getJSON`) |
| Candidate code via `node:vm` | `context.sandbox.runCode(code, ...)` — top-level `runCode`, timeout in **seconds** |
| — | Honor `context.request.signal` (check `signal?.aborted` in the task loop, exit gracefully) |
| — | Frontend must send `makers-conversation-id` header on AI endpoint calls |
| — | Cap loops (we already do: fixed task list, bounded harness calls) |
| — | Wrap every model/tool call in try/catch; emit `error_message` events, never crash the stream |

**Porting plan (concrete):**
1. `edgeone makers create claude-agent-starter-node` → get a real scaffold; copy its `agents/`
   skeleton idioms (`_shared.ts` SSE helper, `_model.ts` env mapping) into our repo.
2. Refactor `server/engine/llm.mjs` so the constructor takes `{ baseUrl, apiKey, model }`
   explicitly. Dev server passes `process.env`; the agent passes `context.env`. (~10 lines.)
3. Refactor `server/engine/sandbox.mjs` to accept an injectable executor:
   default = `node:vm` (local); agent passes a wrapper around `context.sandbox.runCode`.
   The wrapper runs: candidate source + a test-call snippet that prints JSON; parse stdout.
4. Rewrite `agents/judge/index.ts`: `onRequest(context)` → read `context.request.body`
   (`{name, source, model}`) → stream SSE events (map our existing event objects into
   `data:` lines with a 5s `ping` interval) → on completion POST the row to the
   leaderboard cloud function (server-side fetch) → `data: [DONE]`.
5. New `cloud-functions/leaderboard/index.ts`: GET returns ranked rows, POST appends a row.
   Storage: Blob `setJSON('rubric/leaderboard', rows)`. Copy the `rank()` function from
   `server/engine/store.mjs` (correctness → tokens → cost → latency). Seed with the two
   baseline rows if empty (hardcode the verified numbers: One-Shot 2/4/545tok/$0.0016/0.8s,
   Self-Repair 4/4/910tok/$0.0026/1.4s — or re-run them live once the gateway works).
6. Frontend `src/api.ts`: point submit at `/judge`, leaderboard at `/leaderboard`; add the
   `makers-conversation-id` header (any stable UUID per page load); switch the stream parser
   from NDJSON lines to SSE (`data: ` prefix, ignore `ping`, stop at `[DONE]`). Keep the
   NDJSON path working when hitting the local dev server (feature-detect by content-type).
7. Test everything under `edgeone makers dev` (port 8088) BEFORE deploying.

**Fallback if the port hits trouble at the venue:** the local mock demo (`npm run dev`) is
fully working and proves the entire concept. Deploy the static frontend alone if needed and
demo the run loop locally. A working local demo beats a broken cloud demo.

---

## 5. Venue runbook (hacking window is 60 minutes — timebox hard)

**Before the venue (morning):**
- [ ] Push repo to GitHub (see §6)
- [ ] Record a 60–90s screen capture of the local demo working (fallback + submission video)
- [ ] Build the 5-slide deck (outline in §8)
- [ ] If possible: install CLI + login + scaffold NOW so venue time is pure porting

**At the venue:**
```bash
# 0–10 min — setup
npm i -g edgeone@latest        # need ≥ 1.6.0
export PAGES_SOURCE=skills     # required before every edgeone command
edgeone whoami || edgeone login   # browser login; pick Global site
edgeone makers create claude-agent-starter-node   # reference scaffold (separate dir)

# 10–35 min — port (steps 2–6 in §4; lean on Cursor with the prompts in §9)

# 35–50 min — integrate & deploy
edgeone makers dev             # local runtime :8088 — verify submit works end-to-end
edgeone makers deploy --json   # NEVER truncate the returned URL (query params required)

# 50–60 min — reality check
# open deploy URL on your PHONE, submit Self-Repair preset, watch it hit 4/4
# screenshot everything for the deck
```

---

## 6. Push to GitHub (from Cursor, where auth works)

Repo is committed locally on `main` (commit `2c93c79`, 27 files, clean tree).
From Cursor's terminal:

```bash
cd ~/Desktop/hackathons/agent-forge
gh repo create rubric --public --source=. --push
# — or, if creating the repo in the GitHub UI instead —
git remote add origin https://github.com/<your-username>/rubric.git
git push -u origin main
```

`.gitignore` already excludes `node_modules/`, `.claude/`, `.agents/`, `.mcp.json`,
`server/.data/`. Commit this PLAYBOOK.md too.

---

## 7. Judging rubric → how Rubric scores (make these explicit in the demo)

| Criterion | Our answer |
|---|---|
| **Completeness** | Working end-to-end: submit real code → sandboxed run → hidden tests → metered scoring → ranked leaderboard. Seeded baselines prove it before anyone touches it. |
| **Innovation** | First "LeetCode for harness engineering." The insight: rank on correctness *then efficiency* — that tiebreak is what makes it a standard rather than a vibes contest. |
| **Real-life problem** | Companies can't measure agent-engineering skill; teams hand-roll private evals; hiring has no signal. The model is a commodity — the harness is the skill. |
| **Sponsored product usage** | Sandbox (untrusted code — impossible without it), AI Gateway (same metered model for all), Blob (durable leaderboard), agent runtime + one-click deploy (judges submit from phones), observability panel during demo. Every primitive is load-bearing, none decorative. |

**One-liner:** *"Don't solve the problem. Engineer the agent that solves it."*

---

## 8. Slide deck (5 slides, 3-minute demo — build in the morning)

1. **The pain** — "Every AI team hand-rolls agent evals. There's no standard signal for harness
   skill. LeetCode standardized coding interviews; nothing standardized this." (dark slide, one line)
2. **Rubric** — screenshot of the hero. "Same model for everyone. Compete on the harness.
   Pass-rate, then tokens, then cost, then latency. The leaderboard is the credential."
3. **LIVE DEMO** (90s) — leaderboard shows One-Shot at 2/4 → load Self-Repair preset → Submit →
   live sandbox run, self-repair fires (2× calls on the mediums) → lands 4/4. "Same model.
   Twice the score. That's the skill we measure."
4. **Built on EdgeOne** — the primitives table from §3. "Running untrusted harness code against
   a hidden benchmark is impossible without a sandbox, a metered gateway, and one-click deploy.
   Here's the live URL — submit from your phone right now." (QR code of deploy URL)
5. **The ask / roadmap** — more benchmarks (SWE-bench-style bug-fix, tool-use, research),
   private company leagues (eval your team's harnesses on YOUR tasks), the hiring credential.

**Demo video (for AI pre-screening):** 60–90s screen recording, no talking needed:
open app → point at One-Shot 2/4 on leaderboard → click Self-Repair preset → Submit → let the
run panel animate → leaderboard re-ranks with 4/4 highlighted → end on the EdgeOne deploy URL
in the browser bar. AI reviewers check "does it actually work" — show it working, uncut.

---

## 9. Paste-ready prompts for Cursor/Codex (the port, split into 3 tasks)

**Task A — agent port:**
> Read `.agents/skills/edgeone-makers-agents/SKILL.md` (red lines) and PLAYBOOK.md §4 in this
> repo. Rewrite `agents/judge/index.ts` for the EdgeOne Makers runtime: `export async function
> onRequest(context)`, body from `context.request.body`, env from `context.env` (never
> process.env), stream SSE (`data:` JSON events matching the shapes in
> `server/engine/runner.mjs` emits, plus a 5s ping heartbeat, headers `X-Accel-Buffering: no`
> / `Cache-Control: no-cache`, end `data: [DONE]`), honor `context.request.signal`, wrap model
> calls in try/catch emitting `error_message` events. Reuse `server/engine/runner.mjs` by
> refactoring `server/engine/llm.mjs` to take `{baseUrl, apiKey, model}` in its constructor
> (dev server keeps process.env; agent passes context.env values).

**Task B — leaderboard cloud function:**
> Read `.agents/skills/edgeone-makers-storage/SKILL.md` and `makers-cloud-functions`. Create
> `cloud-functions/leaderboard/index.ts`: GET returns rows ranked by the exact comparator in
> `server/engine/store.mjs` `rank()`; POST validates and appends one row. Persist with Blob
> storage (`@edgeone/pages-blob`, `setJSON`/`getJSON` under key `rubric/leaderboard`). Seed
> with the two baseline rows from PLAYBOOK.md §4 step 5 when empty.

**Task C — frontend switch:**
> In `src/api.ts` and `src/App.tsx`: submissions POST to `/judge` with a
> `makers-conversation-id` header (UUID per page load); leaderboard reads `/leaderboard`.
> Parse SSE (`data: ` lines, ignore `ping`, stop at `[DONE]`) but keep NDJSON parsing when
> the response content-type is `application/x-ndjson` so local `npm run dev` still works.
> Don't touch the visual design.

---

## 10. Machine quirks (this laptop only)

- macOS **Guest account, no admin**: Node is user-local at `~/node/bin` (in `~/.zprofile`/
  `~/.zshrc`). Non-interactive shells may need `export PATH="$HOME/node/bin:$PATH"`.
- `gh` CLI installed at `~/node/bin/gh` but **not authenticated** here (auth lives in Cursor).
- Preview/dev launcher must use `scripts/dev.sh` (PATH wrapper).
- MCP servers configured in `.mcp.json` (context7, shadcn, magicui) with explicit PATH env.
