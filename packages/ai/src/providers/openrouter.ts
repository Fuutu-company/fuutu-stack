import { devToolsMiddleware } from "@ai-sdk/devtools";
import { createOpenAI } from "@ai-sdk/openai";
import { createLogger } from "@fuutu/logs";
import type { ModelMessage } from "ai";
import { generateText, streamText, wrapLanguageModel } from "ai";
import type {
	AIChatOptions,
	AIChatResponse,
	AIMessage,
	AIProvider,
} from "../types";

export interface OpenRouterProviderOptions {
	apiKey?: string;
	baseURL?: string;
	model?: string;
	/** Whether to apply the AI SDK devtools middleware. Defaults to false. */
	devtools?: boolean;
}

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

/**
 * OpenRouter provider — v1 active default.
 *
 * OpenRouter is an OpenAI-compatible gateway that routes to many model
 * vendors (OpenAI, Anthropic, Google, Meta, …) behind a single API key.
 * We reuse `@ai-sdk/openai` with a custom `baseURL` pointing at
 * `https://openrouter.ai/api/v1` (overridable via `AI_BASE_URL` for
 * self-hosted/proxy setups). Model ids are vendor-prefixed
 * (e.g. `openai/gpt-4o-mini`, `anthropic/claude-3.5-sonnet`).
 *
 * The devtools middleware is applied only when `devtools: true` is passed
 * (the resolver sets this in development) to surface stream events in the
 * AI SDK devtools UI. The constructor does not access `env` directly so
 * it can be instantiated in tests without full env validation.
 */
export class OpenRouterProvider implements AIProvider {
	readonly id = "openrouter";

	private readonly model: Parameters<typeof generateText>[0]["model"];

	private readonly log = createLogger({ scope: "ai:openrouter" });

	constructor(options: OpenRouterProviderOptions = {}) {
		const openai = createOpenAI({
			apiKey: options.apiKey,
			baseURL: options.baseURL ?? DEFAULT_BASE_URL,
		});
		const baseModel = openai(options.model ?? DEFAULT_MODEL);
		this.model = options.devtools
			? wrapLanguageModel({
					model: baseModel,
					middleware: devToolsMiddleware(),
				})
			: baseModel;
	}

	async chat(
		messages: AIMessage[],
		options?: AIChatOptions,
	): Promise<AIChatResponse> {
		try {
			const result = await generateText({
				model: this.model,
				// AIMessage is a simplified {role, content} shape; cast to
				// ModelMessage (the SDK's discriminated union) since the
				// mapped objects are structurally compatible.
				messages: messages.map((m) => ({
					role: m.role,
					content: m.content,
				})) as ModelMessage[],
				temperature: options?.temperature,
				maxOutputTokens: options?.maxTokens,
			});
			return {
				content: result.text,
				role: "assistant",
			};
		} catch (error) {
			this.log.error("chat() failed", { err: error });
			throw error;
		}
	}

	async stream(
		messages: AIMessage[],
		options?: AIChatOptions,
	): Promise<ReadableStream<Uint8Array>> {
		try {
			const result = streamText({
				model: this.model,
				// AIMessage is a simplified {role, content} shape; cast to
				// ModelMessage (the SDK's discriminated union) since the
				// mapped objects are structurally compatible.
				messages: messages.map((m) => ({
					role: m.role,
					content: m.content,
				})) as ModelMessage[],
				temperature: options?.temperature,
				maxOutputTokens: options?.maxTokens,
			});
			const response = result.toUIMessageStreamResponse();
			return (
				response.body ??
				new ReadableStream<Uint8Array>({
					start(controller) {
						controller.close();
					},
				})
			);
		} catch (error) {
			this.log.error("stream() failed", { err: error });
			throw error;
		}
	}
}
