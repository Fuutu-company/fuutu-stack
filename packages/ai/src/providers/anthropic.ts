import type {
	AIChatOptions,
	AIChatResponse,
	AIMessage,
	AIProvider,
} from "../types";

/**
 * Anthropic provider — skeleton (inactive in v1).
 *
 * Implements the `AIProvider` interface but throws on every call so a
 * misconfigured deploy fails loudly instead of silently no-op'ing. Wire it up
 * by porting the call logic from `GoogleProvider` and setting `AI_PROVIDER=anthropic`.
 */
export class AnthropicProvider implements AIProvider {
	readonly id = "anthropic";

	async chat(
		_messages: AIMessage[],
		_options?: AIChatOptions,
	): Promise<AIChatResponse> {
		throw new Error(
			"Anthropic provider not implemented. Set AI_PROVIDER=google to use the active provider.",
		);
	}

	async stream(
		_messages: AIMessage[],
		_options?: AIChatOptions,
	): Promise<ReadableStream<Uint8Array>> {
		throw new Error(
			"Anthropic provider not implemented. Set AI_PROVIDER=google to use the active provider.",
		);
	}
}
