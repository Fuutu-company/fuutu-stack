import { env } from "@fuutu/env/saas";
import type { AIProviderId } from "./types";

/**
 * AI configuration — owned by @fuutu/ai.
 *
 * Provider selection is env-driven: `AI_PROVIDER` picks the active provider
 * and `AI_MODEL` overrides the default model. API keys are runtime secrets
 * (config.md §5) and stay in the resolver, not in config.
 *
 * Default provider is `openrouter` — an OpenAI-compatible gateway that
 * routes to many model vendors behind a single API key. Set `AI_PROVIDER`
 * to `google`/`openai`/`anthropic`/`noop` to switch.
 */
export const aiConfig = {
	get provider(): AIProviderId {
		return env.AI_PROVIDER ?? "openrouter";
	},
	get defaultModel(): string {
		return env.AI_MODEL ?? "openai/gpt-4o-mini";
	},
};
