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

/** Per-provider default models — model ID formats differ per provider
 * (OpenRouter is vendor-prefixed, Google/OpenAI/Anthropic are bare). */
const DEFAULT_MODELS: Record<AIProviderId, string> = {
	openrouter: "openai/gpt-4o-mini",
	google: "gemini-2.0-flash",
	openai: "gpt-4o-mini",
	anthropic: "claude-haiku-4-5",
	noop: "noop",
};

export const aiConfig = {
	get provider(): AIProviderId {
		return env.AI_PROVIDER ?? "openrouter";
	},
	/**
	 * Default model for the *active* provider. Prefer
	 * `aiConfig.defaultModelFor(id)` when the provider id is known —
	 * this getter assumes the configured provider.
	 */
	get defaultModel(): string {
		return this.defaultModelFor(this.provider);
	},
	/** `AI_MODEL` env override wins; otherwise the provider's default. */
	defaultModelFor(provider: AIProviderId): string {
		return env.AI_MODEL ?? DEFAULT_MODELS[provider];
	},
};
