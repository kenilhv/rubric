import type { ProblemPayload, Row, RunEvent } from "./types";

const CONVERSATION_ID =
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `rubric-${Date.now()}`;

function edgeOneApi(): boolean {
  if (typeof window === "undefined") return false;
  const port = window.location.port;
  const host = window.location.hostname;
  return port === "8088" || host.includes("edgeone") || host.includes("makers");
}

function problemUrl() {
  return edgeOneApi() ? "/problem" : "/api/problem";
}

function leaderboardUrl() {
  return edgeOneApi() ? "/leaderboard" : "/api/leaderboard";
}

function submitUrl() {
  return edgeOneApi() ? "/judge" : "/api/submit";
}

export async function getProblem(): Promise<ProblemPayload> {
  const r = await fetch(problemUrl());
  if (!r.ok) throw new Error("failed to load problem");
  return r.json();
}

export async function getLeaderboard(): Promise<Row[]> {
  const r = await fetch(leaderboardUrl());
  if (!r.ok) throw new Error("failed to load leaderboard");
  return (await r.json()).rows;
}

export async function resetBoard(): Promise<Row[]> {
  if (!edgeOneApi()) {
    const local = await fetch("/api/reset", { method: "POST" });
    return (await local.json()).rows;
  }
  const r = await fetch(leaderboardUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reset: true }),
  });
  return (await r.json()).rows;
}

async function parseNdjsonStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (e: RunEvent) => void
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) onEvent(JSON.parse(line) as RunEvent);
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer.trim()) as RunEvent);
}

async function parseSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (e: RunEvent) => void
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const line of block.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === "[DONE]") continue;
        const parsed = JSON.parse(payload);
        if (parsed.type === "ping") continue;
        onEvent(parsed as RunEvent);
      }
    }
  }
}

export async function submitHarness(
  payload: { name: string; source: string; model?: string },
  onEvent: (e: RunEvent) => void
): Promise<void> {
  const res = await fetch(submitUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "makers-conversation-id": CONVERSATION_ID,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`submit failed (${res.status})`);
  if (!res.body) throw new Error("no stream");

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/event-stream")) {
    await parseSseStream(res.body, onEvent);
  } else {
    await parseNdjsonStream(res.body, onEvent);
  }
}
