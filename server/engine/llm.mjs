// Metered LLM client. Every harness gets its own instance so we can bill tokens
// per submission. On EdgeOne it calls the injected AI Gateway (OpenAI-compatible);
// with no gateway configured it falls back to a deterministic mock so the whole
// platform runs locally with zero API keys.
import { mockComplete } from "./mockModel.mjs";

// Rough public per-1M-token pricing so the leaderboard has a real cost axis.
const PRICE = {
  "claude-haiku-4-5-20251001": { in: 1.0, out: 5.0 },
  "claude-sonnet-5": { in: 3.0, out: 15.0 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  default: { in: 1.0, out: 5.0 },
};

export class LLM {
  constructor({ model } = {}) {
    this.model = model || process.env.RUBRIC_MODEL || "claude-haiku-4-5-20251001";
    this.baseUrl = process.env.AI_GATEWAY_BASE_URL || "";
    this.apiKey = process.env.AI_GATEWAY_API_KEY || "";
    this.live = Boolean(this.baseUrl && this.apiKey);
    this.usage = { calls: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cost_usd: 0 };
  }

  _bill(promptTokens, completionTokens) {
    const p = PRICE[this.model] || PRICE.default;
    const cost = (promptTokens / 1e6) * p.in + (completionTokens / 1e6) * p.out;
    this.usage.calls += 1;
    this.usage.prompt_tokens += promptTokens;
    this.usage.completion_tokens += completionTokens;
    this.usage.total_tokens += promptTokens + completionTokens;
    this.usage.cost_usd = round6(this.usage.cost_usd + cost);
  }

  // messages: [{role, content}] -> string content. Meters usage as a side effect.
  async chat(messages, { temperature = 0, max_tokens = 1200 } = {}) {
    if (!this.live) {
      const { content, prompt_tokens, completion_tokens } = mockComplete(messages);
      await tick();
      this._bill(prompt_tokens, completion_tokens);
      return content;
    }
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, messages, temperature, max_tokens }),
    });
    if (!res.ok) throw new Error(`gateway ${res.status}: ${await res.text().catch(() => "")}`);
    const data = await res.json();
    const u = data.usage || {};
    this._bill(u.prompt_tokens || 0, u.completion_tokens || 0);
    return data.choices?.[0]?.message?.content ?? "";
  }
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}
function tick() {
  return new Promise((r) => setTimeout(r, 120 + Math.random() * 180));
}
