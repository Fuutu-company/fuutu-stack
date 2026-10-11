/**
 * @fuutu/ai — provider-agnostic AI interface.
 *
 * Every provider implements `AIProvider`. One provider is active per deploy
 * (selected via `aiConfig.provider`); unimplemented providers ship as skeletons
 * that throw on call so a misconfigured deploy fails loudly.
 */

export interface AIProvider {
	readonly id: string;
	chat(messages: AIMessage[], options?: AIChatOptions): Promise<AIChatResponse>;
	/**
	 * Streams the completion as raw UTF-8 text chunks (not SSE/UI-message
	 * frames) — consumers decode and render the bytes directly.
	 */
	stream(
		messages: AIMessage[],
		options?: AIChatOptions,
	): Promise<ReadableStream<Uint8Array>>;
}

export interface AIMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

export interface AIChatOptions {
	temperature?: number;
	maxTokens?: number;
}

export interface AIChatResponse {
	content: string;
	role: "assistant";
}

export type AIProviderId =
	| "openrouter"
	| "google"
	| "openai"
	| "anthropic"
	| "noop";
