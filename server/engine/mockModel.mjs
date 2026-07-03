// Deterministic stand-in for a real model, used when no AI Gateway is configured.
// It is intentionally *imperfect*: on the two harder tasks its first attempt is
// subtly wrong and fails the public example. A harness that runs the example and
// re-prompts with the failure ("FAILED") gets the corrected solution — so better
// harness engineering earns a higher score, exactly like it would with a real model.

const SOLUTIONS = {
  twoSum: {
    first: `function twoSum(nums, target){
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return [];
}`,
  },
  isValid: {
    first: `function isValid(s){
  const st = []; const m = { ')': '(', ']': '[', '}': '{' };
  for (const c of s) {
    if (c === '(' || c === '[' || c === '{') st.push(c);
    else if (st.pop() !== m[c]) return false;
  }
  return st.length === 0;
}`,
  },
  lengthOfLongestSubstring: {
    // BUG: counts total distinct characters, not the longest window.
    first: `function lengthOfLongestSubstring(s){
  const set = new Set(); let max = 0;
  for (const c of s) { set.add(c); max = Math.max(max, set.size); }
  return max;
}`,
    fixed: `function lengthOfLongestSubstring(s){
  const last = new Map(); let start = 0, max = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (last.has(c) && last.get(c) >= start) start = last.get(c) + 1;
    last.set(c, i);
    max = Math.max(max, i - start + 1);
  }
  return max;
}`,
  },
  mergeIntervals: {
    // BUG: assumes the input is already sorted by start.
    first: `function mergeIntervals(intervals){
  const res = [];
  for (const iv of intervals) {
    const last = res[res.length - 1];
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
    else res.push([iv[0], iv[1]]);
  }
  return res;
}`,
    fixed: `function mergeIntervals(intervals){
  const arr = [...intervals].sort((a, b) => a[0] - b[0]);
  const res = [];
  for (const iv of arr) {
    const last = res[res.length - 1];
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
    else res.push([iv[0], iv[1]]);
  }
  return res;
}`,
  },
};

export function mockComplete(messages) {
  const text = messages.map((m) => m.content).join("\n");
  const fnName = Object.keys(SOLUTIONS).find((n) => text.includes(n));
  const isRefine = /FAILED|did not pass|expected .* got|assertion/i.test(text);

  let code;
  if (!fnName) {
    code = `// unable to determine target function\nfunction solve(){ return null; }`;
  } else {
    const entry = SOLUTIONS[fnName];
    code = isRefine && entry.fixed ? entry.fixed : entry.first;
  }

  const content = `Here is my solution:\n\n\`\`\`js\n${code}\n\`\`\`\n`;
  const prompt_tokens = Math.max(40, Math.round(text.length / 4));
  const completion_tokens = Math.round(content.length / 4);
  return { content, prompt_tokens, completion_tokens };
}
