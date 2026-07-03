// Sandbox for running untrusted code. Two layers run here:
//   1. the competitor's harness (async, calls the metered llm)
//   2. the candidate solution the harness returns (sync, run against hidden tests)
// Locally we use node:vm with hard timeouts (kills infinite loops). On EdgeOne
// the same calls are routed to the platform sandbox for real isolation.
import vm from "node:vm";

const HARNESS_TIMEOUT_MS = Number(process.env.HARNESS_TIMEOUT_MS || 30000);
const SOLUTION_TIMEOUT_MS = Number(process.env.SOLUTION_TIMEOUT_MS || 2000);

// Pull a fenced ```js code block (or the raw text) out of a model reply.
export function extractCode(text) {
  if (typeof text !== "string") return "";
  const fence = text.match(/```(?:js|javascript|ts|typescript)?\s*([\s\S]*?)```/i);
  return (fence ? fence[1] : text).trim();
}

// Compile harness source into a callable async solve(spec, llm).
export function compileHarness(source) {
  const wrapped = `${source}
;return (typeof solve !== "undefined" && solve) || (typeof harness !== "undefined" && harness) || null;`;
  let fn;
  try {
    // eslint-disable-next-line no-new-func
    fn = new Function(wrapped)();
  } catch (e) {
    throw new Error(`harness failed to compile: ${e.message}`);
  }
  if (typeof fn !== "function") {
    throw new Error("harness must define an (async) function named `solve`");
  }
  return fn;
}

export async function runHarness(solve, spec, llm) {
  return await withTimeout(
    Promise.resolve().then(() => solve(spec, llm)),
    HARNESS_TIMEOUT_MS,
    "harness timed out"
  );
}

// Run a candidate solution against one input. Returns { ok, value, error }.
export function runCandidate(solutionSource, fnName, args) {
  const context = vm.createContext({ __ARGS__: safeClone(args), __OUT__: null });
  const src = `
    ${solutionSource}
    ;__OUT__ = JSON.stringify(${fnName}.apply(null, __ARGS__));
  `;
  try {
    new vm.Script(src).runInContext(context, { timeout: SOLUTION_TIMEOUT_MS });
    return { ok: true, value: context.__OUT__ == null ? null : JSON.parse(context.__OUT__) };
  } catch (e) {
    return { ok: false, error: `${e.name}: ${e.message}` };
  }
}

// EdgeOne sandbox executor — writes candidate to /tmp and runs via node.
export function createEdgeOneRunCandidate(context) {
  return async function runCandidateEdgeOne(solutionSource, fnName, args) {
    const wrapped = `
${solutionSource}
const __args = ${JSON.stringify(args)};
const __out = ${fnName}.apply(null, __args);
console.log(JSON.stringify(__out));
`;
    try {
      await context.sandbox.files.write("/tmp/rubric-candidate.js", wrapped);
      const result = await context.sandbox.commands.run("node /tmp/rubric-candidate.js", {
        timeout: Math.ceil(SOLUTION_TIMEOUT_MS / 1000),
      });
      if (result.exitCode !== 0) {
        return { ok: false, error: result.stderr?.trim() || `exit ${result.exitCode}` };
      }
      const line = (result.stdout || "").trim().split("\n").pop();
      return { ok: true, value: line ? JSON.parse(line) : null };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  };
}

function safeClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function withTimeout(promise, ms, message) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}
