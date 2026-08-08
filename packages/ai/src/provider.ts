import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import { aiConfig } from "./config";
import { AnthropicProvider } from "./providers/anthropic";
import { GoogleProvider } from "./providers/google";
import { NoopProvider } from "./providers/noop";
import { OpenAIProvider } from "./providers/openai";
import type { AIProvider, AIProviderId } from "./types";

const log = createLogger({ scope: "ai:resolve" });

/**
 * Resolve the API key for the google provider.
 * Falls back to the legacy `GOOGLE_GENERATIVE_AI_API_KEY` env var.
 */
function resolveApiKey(): string | undefined {
	return env.AI_API_KEY ?? env.GOOGLE_GENERATIVE_AI_API_KEY;
}

/**
 * Resolve the active AI provider from `aiConfig.provider`.
 *
 * If a real provider is selected but its API key is missing, we downgrade to
 * the noop provider and log a warning — mirroring the mail package's
 * missing-key fallback (see `packages/mail/src/config.ts`). This keeps dev
 * installs working out-of-the-box instead of crashing at call time.
 *
 * Provider instances are cached as singletons (module-level) — consistent
 * with mail/storage/payments. The underlying SDK client is lazy, so the
 * first call triggers the actual connection.
 */
const noopProvider = new NoopProvider();
const openaiProvider = new OpenAIProvider();
const anthropicProvider = new AnthropicProvider();

let googleProvider: GoogleProvider | undefined;

export function resolveAIProvider(): AIProvider {
	switch (aiConfig.provider) {
		case "google": {
			const apiKey = resolveApiKey();
			if (!apiKey) {
				log.warn(
					"AI_PROVIDER=google but AI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) is not set — falling back to noop provider.",
				);
				return noopProvider;
			}
			if (!googleProvider) {
				googleProvider = new GoogleProvider({
					apiKey,
					model: aiConfig.defaultModel,
				});
			}
			return googleProvider;
		}
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
		case "google": {
			const apiKey = resolveApiKey();
			if (!apiKey) {
				log.warn(
					"AI_PROVIDER=google but AI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) is not set — falling back to noop provider.",
				);
				return noopProvider;
			}
			if (!googleProvider) {
				googleProvider = new GoogleProvider({
					apiKey,
					model: aiConfig.defaultModel,
				});
			}
			return googleProvider;
		}
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
