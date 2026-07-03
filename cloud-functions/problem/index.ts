import { PROBLEM, TASKS, publicSpec } from "../../server/engine/codingBench.mjs";
import {
  STARTER_SRC,
  ONE_SHOT_SRC,
  SELF_REPAIR_SRC,
} from "../../server/engine/baselines.mjs";

export async function onRequestGet(context: any) {
  const live = Boolean(
    context.env.AI_GATEWAY_API_KEY && context.env.AI_GATEWAY_BASE_URL
  );
  return new Response(
    JSON.stringify({
      problem: PROBLEM,
      tasks: TASKS.map(publicSpec),
      starter: STARTER_SRC,
      presets: {
        starter: STARTER_SRC,
        oneShot: ONE_SHOT_SRC,
        selfRepair: SELF_REPAIR_SRC,
      },
      live,
    }),
    { headers: { "content-type": "application/json" } }
  );
}
