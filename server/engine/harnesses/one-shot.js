// One-Shot — a single model call, no self-testing. This is the floor: it nails
// the easy tasks but ships whatever the model returns first, bugs and all.
async function solve(spec, llm) {
  const prompt = [
    {
      role: "user",
      content:
        `Write a correct JavaScript function.\n` +
        `Signature: ${spec.signature}\n` +
        `Task: ${spec.statement}\n` +
        `Return ONLY a \`\`\`js code block defining a function named ${spec.fnName}.`,
    },
  ];
  return await llm(prompt);
}
