import type {
	AIChatOptions,
	AIChatResponse,
	AIMessage,
	AIProvider,
} from "../types";

/**
 * Noop AI provider — returns empty responses, never throws.
 *
 * Used in tests and for deploys that want to disable AI without configuring
 * credentials. `chat()` resolves to an empty assistant message; `stream()`
 * resolves to an empty byte stream.
 */
export class NoopProvider implements AIProvider {
	readonly id = "noop";

	async chat(
		_messages: AIMessage[],
		_options?: AIChatOptions,
	): Promise<AIChatResponse> {
		return {
			content: "",
			role: "assistant",
		};
	}

	async stream(
		_messages: AIMessage[],
		_options?: AIChatOptions,
	): Promise<ReadableStream<Uint8Array>> {
		return new ReadableStream<Uint8Array>({
			start(controller) {
				controller.close();
			},
		});
	}
}
