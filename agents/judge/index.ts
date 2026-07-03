// EdgeOne Makers agent: POST /judge
// Streams a harness run as SSE; posts the result to the leaderboard cloud function.

import { createSSEResponse, sseEvent } from "../_shared";
import { runSubmission } from "../../server/engine/runner.mjs";
import { createEdgeOneRunCandidate } from "../../server/engine/sandbox.mjs";
import { rank } from "../../server/engine/rank.mjs";

type JudgeBody = { name?: string; source?: string; model?: string };

async function postLeaderboardRow(
  baseUrl: string,
  row: Record<string, unknown>
): Promise<{ rows: unknown[] } | null> {
  try {
    const res = await fetch(`${baseUrl}/leaderboard`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ row }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function requestBaseUrl(context: any): string {
  const host =
    context.request.headers["x-forwarded-host"] || context.request.headers["host"] || "";
  const proto = context.request.headers["x-forwarded-proto"] || "https";
  return host ? `${proto}://${host}` : "";
}

export async function onRequestPost(context: any) {
  const body = (context.request.body || {}) as JudgeBody;
  const name = String(body.name || "anon").slice(0, 40) || "anon";
  const source = String(body.source || "");
  const model = body.model ? String(body.model) : undefined;
  const signal = context.request.signal as AbortSignal | undefined;
  const baseUrl = requestBaseUrl(context);

  const llmConfig = {
    baseUrl: context.env.AI_GATEWAY_BASE_URL,
    apiKey: context.env.AI_GATEWAY_API_KEY,
    model: model || context.env.RUBRIC_MODEL,
  };

  const runCandidateFn = context.sandbox
    ? createEdgeOneRunCandidate(context)
    : undefined;

  async function* runSubmissionStream(_signal?: AbortSignal): AsyncGenerator<string> {
    const queue: Record<string, unknown>[] = [];
    let finished = false;
    let fatal: string | null = null;

    const runPromise = runSubmission(
      { name, author: "you", source, model },
      {
        llmConfig,
        runCandidateFn,
        signal: _signal,
        onEvent: (e) => queue.push(e),
      }
    ).then(async ({ row, error }) => {
      if (error) {
        fatal = error;
        return;
      }
      if (row && baseUrl) {
        const lb = await postLeaderboardRow(baseUrl, row);
        if (lb?.rows) {
          queue.push({ type: "leaderboard", rows: rank(lb.rows as any[]) });
        }
      }
    }).finally(() => {
      finished = true;
    });

    while (!finished || queue.length) {
      if (_signal?.aborted) {
        yield sseEvent({ type: "error_message", content: "run aborted" });
        break;
      }
      while (queue.length) {
        yield sseEvent(queue.shift()!);
      }
      if (!finished) await new Promise((r) => setTimeout(r, 40));
    }

    await runPromise;

    if (fatal) {
      yield sseEvent({ type: "compile_error", error: fatal });
    }
  }

  return createSSEResponse(runSubmissionStream, signal);
}
