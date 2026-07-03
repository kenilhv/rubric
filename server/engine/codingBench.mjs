// The benchmark. Each task ships a public example (competitors can self-test
// against it inside their harness) and a set of HIDDEN tests used for scoring.
// Language is JavaScript so candidate solutions run in the same sandbox.

export const PROBLEM = {
  slug: "coding-bench",
  title: "Coding Bench",
  kind: "task",
  tagline: "Engineer a harness that writes correct code. Same model for everyone.",
  statement:
    "Your harness receives a coding task and a metered `llm`. Orchestrate the model however you like — draft, self-test, refine, vote — and return JavaScript source that defines the required function. Score is tasks passed on hidden tests; ties break on tokens, then cost, then latency.",
};

export const TASKS = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    fnName: "twoSum",
    signature: "function twoSum(nums: number[], target: number): number[]",
    statement:
      "Return the indices [i, j] (i < j) of the two numbers in `nums` that add up to `target`. Exactly one solution exists; you may not use the same element twice.",
    example: { input: [[2, 7, 11, 15], 9], output: [0, 1] },
    tests: [
      { input: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { input: [[3, 2, 4], 6], expected: [1, 2] },
      { input: [[3, 3], 6], expected: [0, 1] },
      { input: [[-1, -2, -3, -4, -5], -8], expected: [2, 4] },
    ],
  },
  {
    id: "valid-parens",
    title: "Valid Parentheses",
    difficulty: "Easy",
    fnName: "isValid",
    signature: "function isValid(s: string): boolean",
    statement:
      "Given a string of just '()[]{}', return true if every bracket is closed by the same type in the correct order.",
    example: { input: ["()[]{}"], output: true },
    tests: [
      { input: ["()[]{}"], expected: true },
      { input: ["(]"], expected: false },
      { input: ["([)]"], expected: false },
      { input: ["{[]}"], expected: true },
      { input: [""], expected: true },
      { input: ["("], expected: false },
    ],
  },
  {
    id: "longest-substring",
    title: "Longest Substring Without Repeating",
    difficulty: "Medium",
    fnName: "lengthOfLongestSubstring",
    statement:
      "Return the length of the longest substring of `s` that contains no repeating characters.",
    signature: "function lengthOfLongestSubstring(s: string): number",
    // Public example chosen so a naive 'count distinct chars' solution gets it WRONG.
    example: { input: ["pwwkew"], output: 3 },
    tests: [
      { input: ["pwwkew"], expected: 3 },
      { input: ["abcabcbb"], expected: 3 },
      { input: ["bbbbb"], expected: 1 },
      { input: ["abba"], expected: 2 },
      { input: [""], expected: 0 },
      { input: ["dvdf"], expected: 3 },
    ],
  },
  {
    id: "merge-intervals",
    title: "Merge Intervals",
    difficulty: "Medium",
    fnName: "mergeIntervals",
    statement:
      "Given an array of [start, end] intervals, merge all overlapping intervals and return them sorted by start.",
    signature: "function mergeIntervals(intervals: number[][]): number[][]",
    // Unsorted input so a solution that assumes sorted order fails.
    example: {
      input: [[[1, 3], [8, 10], [2, 6], [15, 18]]],
      output: [[1, 6], [8, 10], [15, 18]],
    },
    tests: [
      { input: [[[1, 3], [8, 10], [2, 6], [15, 18]]], expected: [[1, 6], [8, 10], [15, 18]] },
      { input: [[[1, 4], [4, 5]]], expected: [[1, 5]] },
      { input: [[[1, 4], [0, 4]]], expected: [[0, 4]] },
      { input: [[[1, 4], [2, 3]]], expected: [[1, 4]] },
    ],
  },
];

// Competitor-facing view of a task: everything EXCEPT the hidden tests.
export function publicSpec(task) {
  return {
    id: task.id,
    title: task.title,
    difficulty: task.difficulty,
    fnName: task.fnName,
    signature: task.signature,
    statement: task.statement,
    example: task.example,
    hiddenTestCount: task.tests.length,
  };
}

export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  if (a && b && typeof a === "object") {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}
