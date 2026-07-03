import type { ProblemPayload, Row, RunEvent } from "./types";

export async function getProblem(): Promise<ProblemPayload> {
  const r = await fetch("/api/problem");
  if (!r.ok) throw new Error("failed to load problem");
  return r.json();
}

export async function getLeaderboard(): Promise<Row[]> {
  const r = await fetch("/api/leaderboard");
  if (!r.ok) throw new Error("failed to load leaderboard");
  return (await r.json()).rows;
}

export async function resetBoard(): Promise<Row[]> {
  const r = await fetch("/api/reset", { method: "POST" });
  return (await r.json()).rows;
}

// Streams the run as NDJSON, invoking onEvent for each line as it arrives.
export async function submitHarness(
  payload: { name: string; source: string; model?: string },
  onEvent: (e: RunEvent) => void
): Promise<void> {
  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.body) throw new Error("no stream");

  const reader = res.body.getReader();
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
