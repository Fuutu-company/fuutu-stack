import { devToolsMiddleware } from "@ai-sdk/devtools";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createLogger } from "@fuutu/logs";
import type { ModelMessage } from "ai";
import { generateText, streamText, wrapLanguageModel } from "ai";
import type {
	AIChatOptions,
	AIChatResponse,
	AIMessage,
	AIProvider,
} from "../types";

export interface GoogleProviderOptions {
	apiKey?: string;
	model?: string;
	/** Whether to apply the AI SDK devtools middleware. Defaults to false. */
	devtools?: boolean;
}

/**
 * Google Gemini provider — functional, non-default (OpenRouter is the v1 default).
 *
 * Wraps `@ai-sdk/google` behind the `AIProvider` interface so callers stay
 * provider-agnostic. The devtools middleware is applied only when
 * `devtools: true` is passed (the resolver sets this in development) to
 * surface stream events in the AI SDK devtools UI. The constructor does
 * not access `env` directly so it can be instantiated in tests without
 * full env validation.
 */
export class GoogleProvider implements AIProvider {
	readonly id = "google";

	private readonly model: Parameters<typeof generateText>[0]["model"];

	private readonly log = createLogger({ scope: "ai:google" });

	constructor(options: GoogleProviderOptions = {}) {
		const google = createGoogleGenerativeAI(
			options.apiKey ? { apiKey: options.apiKey } : {},
		);
		const baseModel = google(options.model ?? "gemini-2.0-flash");
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
			// Plain UTF-8 text chunks (not SSE UI-message frames) — the API
			// accumulates the raw text for persistence and the client renders
			// it directly as text/plain.
			const response = result.toTextStreamResponse();
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
