import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import { aiConfig } from "./config";
import { AnthropicProvider } from "./providers/anthropic";
import { GoogleProvider } from "./providers/google";
import { NoopProvider } from "./providers/noop";
import { OpenAIProvider } from "./providers/openai";
import { OpenRouterProvider } from "./providers/openrouter";
import type { AIProvider, AIProviderId } from "./types";

const log = createLogger({ scope: "ai:resolve" });

/**
 * Resolve the API key for the active provider.
 * Falls back to the legacy `GOOGLE_GENERATIVE_AI_API_KEY` env var when the
 * provider is `google` and `AI_API_KEY` is not set.
 *
 * Convention exception (AGENTS §6 "one active, rest skeletons"): this
 * package ships TWO functional providers — `openrouter` (v1 default) and
 * `google` (functional but non-default, kept for users on the legacy
 * `GOOGLE_GENERATIVE_AI_API_KEY` env var). `openai`/`anthropic` remain
 * throwing skeletons; `noop` is the dev/test provider.
 */
function resolveApiKey(provider: AIProviderId): string | undefined {
	if (provider === "google") {
		return env.AI_API_KEY ?? env.GOOGLE_GENERATIVE_AI_API_KEY;
	}
	return env.AI_API_KEY;
}

/**
 * Resolve the active AI provider from `aiConfig.provider`.
 *
 * Selecting a real provider without configuring its API key logs an error
 * and throws at resolve time — a missing key is a misconfiguration, not a
 * silent downgrade to empty responses. Set `AI_PROVIDER=noop` to disable AI.
 *
 * Provider instances are cached as singletons (module-level) — consistent
 * with mail/storage/payments. The underlying SDK client is lazy, so the
 * first call triggers the actual connection.
 */
const noopProvider = new NoopProvider();
const openaiProvider = new OpenAIProvider();
const anthropicProvider = new AnthropicProvider();

let googleProvider: GoogleProvider | undefined;
let openrouterProvider: OpenRouterProvider | undefined;

function getGoogleProvider(): AIProvider {
	const apiKey = resolveApiKey("google");
	if (!apiKey) {
		log.error("AI provider configured without API key", {
			provider: "google",
		});
		throw new Error(
			"AI_PROVIDER=google requires AI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) to be set. Set a key or use AI_PROVIDER=noop to disable AI.",
		);
	}
	if (!googleProvider) {
		googleProvider = new GoogleProvider({
			apiKey,
			model: aiConfig.defaultModelFor("google"),
			devtools: env.NODE_ENV === "development",
		});
	}
	return googleProvider;
}

function getOpenRouterProvider(): AIProvider {
	const apiKey = resolveApiKey("openrouter");
	if (!apiKey) {
		log.error("AI provider configured without API key", {
			provider: "openrouter",
		});
		throw new Error(
			"AI_PROVIDER=openrouter requires AI_API_KEY to be set. Set a key or use AI_PROVIDER=noop to disable AI.",
		);
	}
	if (!openrouterProvider) {
		openrouterProvider = new OpenRouterProvider({
			apiKey,
			baseURL: env.AI_BASE_URL,
			model: aiConfig.defaultModelFor("openrouter"),
			devtools: env.NODE_ENV === "development",
		});
	}
	return openrouterProvider;
}

export function resolveAIProvider(): AIProvider {
	switch (aiConfig.provider) {
		case "openrouter":
			return getOpenRouterProvider();
		case "google":
			return getGoogleProvider();
		case "openai":
			return openaiProvider;
		case "anthropic":
			return anthropicProvider;
		case "noop":
			return noopProvider;
		default:
			throw new Error(`Unknown AI provider: ${aiConfig.provider}`);
	}
}

/**
 * Resolve a specific AI provider by id (e.g. for tests or explicit overrides).
 */
export function getAIProvider(id: AIProviderId): AIProvider {
	switch (id) {
		case "openrouter":
			return getOpenRouterProvider();
		case "google":
			return getGoogleProvider();
		case "openai":
			return openaiProvider;
		case "anthropic":
			return anthropicProvider;
		case "noop":
			return noopProvider;
		default:
			throw new Error(`Unknown AI provider: ${id}`);
	}
}
