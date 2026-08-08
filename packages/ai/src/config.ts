import { env } from "@fuutu/env/saas";
import type { AIProviderId } from "./types";

/**
 * AI configuration — owned by @fuutu/ai.
 *
 * Provider selection is env-driven: `AI_PROVIDER` picks the active provider
 * and `AI_MODEL` overrides the default model. API keys are runtime secrets
 * (config.md §5) and stay in the resolver, not in config.
 */
export const aiConfig = {
	get provider(): AIProviderId {
		return env.AI_PROVIDER ?? "google";
	},
	get defaultModel(): string {
		return env.AI_MODEL ?? "gemini-2.0-flash";
	},
};
