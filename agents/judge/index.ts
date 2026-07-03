// EdgeOne Makers agent: POST /agents/judge
//
// This is the production judge. It reuses the SAME engine that server/dev-server.mjs
// runs locally, so behavior is identical — only two things swap at deploy time:
//
//   1. Model calls  -> the real AI Gateway (AI_GATEWAY_API_KEY / AI_GATEWAY_BASE_URL
//      are auto-injected by EdgeOne). server/engine/llm.mjs already prefers the
//      gateway whenever those vars exist, so no change needed here.
//   2. Leaderboard   -> context.store (durable) instead of the local JSON file.
//
// Candidate/harness code executes in the platform sandbox. If EdgeOne's runtime
// exposes a dedicated sandbox tool, route runCandidate() there; the vm-based path
// in server/engine/sandbox.mjs is the local-dev fallback.

import { runSubmission } from "../../server/engine/runner.mjs";
import { PROBLEM, TASKS, publicSpec } from "../../server/engine/codingBench.mjs";
import { STARTER_SRC, ONE_SHOT_SRC, SELF_REPAIR_SRC, BASELINES } from "../../server/engine/baselines.mjs";

const LB_KEY = "rubric:coding-bench:leaderboard";

function rank(rows: any[]) {
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

async function loadRows(context: any): Promise<any[]> {
  const raw = await context.store.get(LB_KEY);
  return raw ? JSON.parse(raw) : [];
}
async function saveRows(context: any, rows: any[]) {
  await context.store.set(LB_KEY, JSON.stringify(rows));
}

async function seedIfEmpty(context: any) {
  const rows = await loadRows(context);
  if (rows.length) return rows;
  for (const b of BASELINES) {
    const { row } = await runSubmission(b);
    if (row) rows.push({ id: rid(), ...row });
  }
  await saveRows(context, rows);
  return rows;
}

const rid = () => Math.random().toString(36).slice(2, 10);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async function handler(request: Request, context: any) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || (request.method === "GET" ? "problem" : "submit");

  if (action === "problem") {
    return json({
      problem: PROBLEM,
      tasks: TASKS.map(publicSpec),
      starter: STARTER_SRC,
      presets: { starter: STARTER_SRC, oneShot: ONE_SHOT_SRC, selfRepair: SELF_REPAIR_SRC },
      live: Boolean(process.env.AI_GATEWAY_API_KEY && process.env.AI_GATEWAY_BASE_URL),
    });
  }

  if (action === "leaderboard") {
    return json({ rows: rank(await seedIfEmpty(context)) });
  }

  if (action === "submit") {
    const body = await request.json().catch(() => ({} as any));
    const name = String(body.name || "anon").slice(0, 40) || "anon";
    const source = String(body.source || "");
    const model = body.model ? String(body.model) : undefined;

    // Stream the run as NDJSON so the UI can animate it (same protocol as dev).
    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (e: unknown) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
        try {
          const { row, error } = await runSubmission({ name, author: "you", source, model }, { onEvent: send });
          if (!error && row) {
            const rows = await seedIfEmpty(context);
            rows.push({ id: rid(), ...row });
            await saveRows(context, rows);
            send({ type: "leaderboard", rows: rank(rows) });
          }
        } catch (e: any) {
          send({ type: "fatal", error: e?.message || String(e) });
        }
        controller.close();
      },
    });
    return new Response(stream, { headers: { "content-type": "application/x-ndjson" } });
  }

  return json({ error: "unknown action" }, 400);
}
