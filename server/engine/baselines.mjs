// House entries that seed a fresh leaderboard, plus the starter code shown in
// the submit editor. Read from real .js files so the same text is runnable,
// editable, and demonstrates the "harness engineering matters" thesis on load.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(here, "harnesses", f), "utf8");

export const ONE_SHOT_SRC = read("one-shot.js");
export const SELF_REPAIR_SRC = read("self-repair.js");

export const STARTER_SRC = `// Your harness. Engineer how the model solves the task.
// - spec: { title, fnName, signature, statement, example, hiddenTestCount }
// - llm(messages, opts?): metered model call -> string
// Return JavaScript source that defines function \`spec.fnName\`.
async function solve(spec, llm) {
  const reply = await llm([
    { role: "user", content:
      "Write JavaScript. Signature: " + spec.signature +
      ". Task: " + spec.statement +
      ". Return only a js code block defining " + spec.fnName + "." },
  ]);
  return reply;
}
`;

export const BASELINES = [
  { name: "One-Shot", author: "house", source: ONE_SHOT_SRC },
  { name: "Self-Repair", author: "house", source: SELF_REPAIR_SRC },
];
