// Local dev API. Mirrors what the EdgeOne judge agent will expose, so the whole
// platform runs on your laptop with zero API keys (mock model) before deploy.
import { createServer } from "node:http";
import { runSubmission } from "./engine/runner.mjs";
import { PROBLEM, TASKS, publicSpec } from "./engine/codingBench.mjs";
import { STARTER_SRC, ONE_SHOT_SRC, SELF_REPAIR_SRC, BASELINES } from "./engine/baselines.mjs";
import * as store from "./engine/store.mjs";

// Fixed API port. We intentionally ignore $PORT (the preview harness sets that to
// the web port, 5173, which Vite owns); the frontend proxies /api here.
const PORT = Number(process.env.RUBRIC_API_PORT || 8787);

async function seedIfEmpty() {
  if (!store.isEmpty()) return;
  console.log("[rubric] seeding baselines…");
  for (const b of BASELINES) {
    const { row } = await runSubmission(b);
    if (row) store.addRow(row);
  }
  console.log("[rubric] leaderboard seeded");
}

function json(res, code, body) {
  const s = JSON.stringify(body);
  res.writeHead(code, { "content-type": "application/json", "content-length": Buffer.byteLength(s) });
  res.end(s);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); } catch { resolve({}); }
    });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  if (req.method === "GET" && path === "/api/problem") {
    return json(res, 200, {
      problem: PROBLEM,
      tasks: TASKS.map(publicSpec),
      starter: STARTER_SRC,
      presets: { starter: STARTER_SRC, oneShot: ONE_SHOT_SRC, selfRepair: SELF_REPAIR_SRC },
      live: Boolean(process.env.AI_GATEWAY_API_KEY && process.env.AI_GATEWAY_BASE_URL),
    });
  }

  if (req.method === "GET" && path === "/api/leaderboard") {
    return json(res, 200, { rows: store.rank(store.loadRows()) });
  }

  if (req.method === "POST" && path === "/api/reset") {
    store.saveRows([]);
    await seedIfEmpty();
    return json(res, 200, { rows: store.rank(store.loadRows()) });
  }

  if (req.method === "POST" && path === "/api/submit") {
    const body = await readBody(req);
    const name = (body.name || "anon").toString().slice(0, 40) || "anon";
    const source = (body.source || "").toString();
    const model = body.model ? String(body.model) : undefined;

    res.writeHead(200, {
      "content-type": "application/x-ndjson",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    const send = (e) => res.write(JSON.stringify(e) + "\n");

    try {
      const { row, error } = await runSubmission({ name, author: "you", source, model }, { onEvent: send });
      if (!error && row) {
        const ranked = store.addRow(row);
        send({ type: "leaderboard", rows: ranked });
      }
    } catch (e) {
      send({ type: "fatal", error: e.message });
    }
    return res.end();
  }

  json(res, 404, { error: "not found" });
});

await seedIfEmpty();
server.listen(PORT, () => console.log(`[rubric] judge API on http://localhost:${PORT}`));
