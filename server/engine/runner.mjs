// Orchestrates a full submission: run the harness on every task, grade the code
// it produces against hidden tests, and meter usage. Emits per-task events so the
// UI can animate the run like a test runner (the signature moment of the demo).
import { LLM } from "./llm.mjs";
import { TASKS, publicSpec, deepEqual } from "./codingBench.mjs";
import { compileHarness, runHarness, runCandidate, extractCode } from "./sandbox.mjs";

async function gradeSolution(solutionCode, task, runCandidateFn = runCandidate) {
  if (!solutionCode || !solutionCode.includes(task.fnName)) {
    return { ok: false, passedCount: 0, firstFail: `no function \`${task.fnName}\` returned` };
  }
  let passedCount = 0;
  for (const test of task.tests) {
    const res = await runCandidateFn(solutionCode, task.fnName, test.input);
    if (!res.ok) return { ok: false, passedCount, firstFail: `runtime ${res.error}` };
    if (!deepEqual(res.value, test.expected)) {
      return {
        ok: false,
        passedCount,
        firstFail: `wrong answer on hidden test #${passedCount + 1}`,
      };
    }
    passedCount++;
  }
  return { ok: true, passedCount, firstFail: "" };
}

export async function runSubmission(
  { name, author = "anon", source, model },
  { onEvent, llmConfig, runCandidateFn, signal } = {}
) {
  const emit = (e) => {
    try {
      onEvent && onEvent(e);
    } catch {}
  };
  const llm = new LLM({ model, ...llmConfig });
  const startedAt = Date.now();

  let solve;
  try {
    solve = compileHarness(source);
  } catch (e) {
    emit({ type: "compile_error", error: e.message });
    return { error: e.message };
  }

  emit({ type: "start", name, model: llm.model, live: llm.live, tasks: TASKS.map((t) => t.id) });

  const llmFn = async (messagesOrString, opts) => {
    const messages =
      typeof messagesOrString === "string"
        ? [{ role: "user", content: messagesOrString }]
        : messagesOrString;
    return await llm.chat(messages, opts);
  };

  const taskResults = [];
  let passed = 0;

  for (const task of TASKS) {
    if (signal?.aborted) {
      emit({ type: "error_message", content: "run aborted" });
      break;
    }
    emit({ type: "task_start", id: task.id, title: task.title });
    const spec = publicSpec(task);
    const before = { tokens: llm.usage.total_tokens, calls: llm.usage.calls, cost: llm.usage.cost_usd };
    const t0 = Date.now();
    let status = "fail";
    let detail = "";

    try {
      const out = await runHarness(solve, spec, llmFn);
      const solutionCode = extractCode(String(out ?? ""));
      const graded = await gradeSolution(solutionCode, task, runCandidateFn);
      if (graded.ok) {
        status = "pass";
        passed++;
        detail = `${task.tests.length}/${task.tests.length} hidden tests`;
      } else {
        detail = graded.firstFail;
      }
    } catch (e) {
      status = "error";
      detail = /timed out/.test(e.message) ? "harness timed out" : e.message;
    }

    const result = {
      id: task.id,
      title: task.title,
      difficulty: task.difficulty,
      status,
      detail,
      tokens: llm.usage.total_tokens - before.tokens,
      calls: llm.usage.calls - before.calls,
      cost_usd: round6(llm.usage.cost_usd - before.cost),
      latency_ms: Date.now() - t0,
    };
    taskResults.push(result);
    emit({ type: "task_done", ...result });
  }

  const row = {
    name,
    author,
    model: llm.model,
    mode: "code",
    score: passed,
    total: TASKS.length,
    accuracy: round2(passed / TASKS.length),
    tokens: llm.usage.total_tokens,
    calls: llm.usage.calls,
    cost_usd: round6(llm.usage.cost_usd),
    latency_ms: Date.now() - startedAt,
    at: new Date().toISOString(),
  };

  emit({ type: "done", row });
  return { row, taskResults };
}

function round2(n) { return Math.round(n * 100) / 100; }
function round6(n) { return Math.round(n * 1e6) / 1e6; }
