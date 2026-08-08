import { devToolsMiddleware } from "@ai-sdk/devtools";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "@fuutu/env/saas";
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
}

/**
 * Google Gemini provider — v1 active.
 *
 * Wraps `@ai-sdk/google` behind the `AIProvider` interface so callers stay
 * provider-agnostic. The devtools middleware is applied only in development
 * to surface stream events in the AI SDK devtools UI.
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
		this.model =
			env.NODE_ENV === "development"
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
