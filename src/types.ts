export type TaskSpec = {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  fnName: string;
  signature: string;
  statement: string;
  example: { input: unknown[]; output: unknown };
  hiddenTestCount: number;
};

export type ProblemMeta = {
  slug: string;
  title: string;
  kind: string;
  tagline: string;
  statement: string;
};

export type ProblemPayload = {
  problem: ProblemMeta;
  tasks: TaskSpec[];
  starter: string;
  presets: { starter: string; oneShot: string; selfRepair: string };
  live: boolean;
};

export type Row = {
  id?: string;
  rank?: number;
  name: string;
  author: string;
  model: string;
  mode: string;
  score: number;
  total: number;
  accuracy: number;
  tokens: number;
  calls: number;
  cost_usd: number;
  latency_ms: number;
  at?: string;
};

export type TaskResult = {
  id: string;
  title: string;
  difficulty: string;
  status: "pass" | "fail" | "error";
  detail: string;
  tokens: number;
  calls: number;
  cost_usd: number;
  latency_ms: number;
};

export type RunEvent =
  | { type: "start"; name: string; model: string; live: boolean; tasks: string[] }
  | { type: "task_start"; id: string; title: string }
  | ({ type: "task_done" } & TaskResult)
  | { type: "done"; row: Row }
  | { type: "leaderboard"; rows: Row[] }
  | { type: "compile_error"; error: string }
  | { type: "fatal"; error: string };
