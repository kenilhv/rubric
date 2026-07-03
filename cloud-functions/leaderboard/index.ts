import { getStore } from "@edgeone/pages-blob";
import { rank } from "../../server/engine/rank.mjs";
import { SEED_ROWS } from "../../server/engine/seedRows.mjs";

const BLOB_KEY = "rubric/leaderboard";
const STORE = "rubric";

async function loadRows(store: ReturnType<typeof getStore>) {
  const data = await store.get(BLOB_KEY, { type: "json", consistency: "strong" });
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as { rows?: unknown[] }).rows)) {
    return (data as { rows: unknown[] }).rows;
  }
  return null;
}

async function saveRows(store: ReturnType<typeof getStore>, rows: unknown[]) {
  await store.setJSON(BLOB_KEY, { rows });
}

async function ensureSeeded(store: ReturnType<typeof getStore>) {
  let rows = await loadRows(store);
  if (rows && rows.length) return rank(rows as any[]);
  rows = SEED_ROWS.map((r) => ({ ...r }));
  await saveRows(store, rows);
  return rank(rows as any[]);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function onRequestGet(context: any) {
  const store = getStore({ name: STORE, consistency: "strong" });
  const rows = await ensureSeeded(store);
  return json({ rows });
}

export async function onRequestPost(context: any) {
  const store = getStore({ name: STORE, consistency: "strong" });
  const body = context.request.body || {};

  if (body.reset) {
    await saveRows(store, SEED_ROWS.map((r) => ({ ...r })));
    return json({ rows: rank(SEED_ROWS as any[]) });
  }

  const row = body.row;
  if (!row || typeof row !== "object") {
    return json({ error: "row required" }, 400);
  }

  const rows = (await loadRows(store)) || SEED_ROWS.map((r) => ({ ...r }));
  rows.push({
    id: Math.random().toString(36).slice(2, 10),
    ...row,
  });
  await saveRows(store, rows);
  return json({ rows: rank(rows as any[]) });
}
