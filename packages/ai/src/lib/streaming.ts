import { resolveAIProvider } from "../provider";
import type { AIMessage } from "../types";

/**
 * Backward-compatible streaming helper.
 *
 * @deprecated Callers should call `resolveAIProvider()` + `provider.stream()`
 * and build their own `Response` directly, as the API chat/stream procedures
 * already do. This wrapper is kept only for external kit users who relied on
 * it before the provider pattern was introduced.
 *
 * Delegates to the active provider's `stream()` and wraps the resulting byte
 * stream in a `text/event-stream` Response — the shape the existing API chat
 * procedure and client `useChat` expect.
 */
export async function createStreamingResponse(messages: AIMessage[]) {
	const provider = resolveAIProvider();
	const stream = await provider.stream(messages);
	return new Response(stream, {
		headers: {
			"content-type": "text/event-stream",
			"cache-control": "no-cache",
			connection: "keep-alive",
		},
	});
}
