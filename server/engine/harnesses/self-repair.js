// Self-Repair — draft a solution, run it against the public example, and if it
// fails, re-prompt the model with the failure so it can fix the bug. Same model
// as One-Shot; the extra scaffolding is what earns the higher score (at a token
// cost — which is exactly what the efficiency tiebreak measures).
async function solve(spec, llm) {
  const ask = (feedback) =>
    llm([
      {
        role: "user",
        content:
          `Write a correct JavaScript function.\n` +
          `Signature: ${spec.signature}\n` +
          `Task: ${spec.statement}\n` +
          (feedback ? feedback + "\n" : "") +
          `Return ONLY a \`\`\`js code block defining a function named ${spec.fnName}.`,
      },
    ]);

  const strip = (t) => {
    const m = String(t).match(/```(?:js|javascript)?\s*([\s\S]*?)```/i);
    return (m ? m[1] : t).trim();
  };

  const passesExample = (src) => {
    try {
      const fn = new Function(src + `\nreturn ${spec.fnName};`)();
      const got = JSON.stringify(fn.apply(null, spec.example.input));
      return got === JSON.stringify(spec.example.output);
    } catch (e) {
      return false;
    }
  };

  let reply = await ask("");
  if (!passesExample(strip(reply))) {
    reply = await ask(
      `Your previous attempt FAILED the example: for input ${JSON.stringify(spec.example.input)} ` +
        `it must return ${JSON.stringify(spec.example.output)}. Fix the bug.`
    );
  }
  return reply;
}
