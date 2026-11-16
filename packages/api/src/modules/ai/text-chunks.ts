/**
 * A provider byte stream as text chunks. Procedures return this async
 * generator — oRPC serialises it as an event stream (`text/event-stream`);
 * a returned `Response` would be JSON-encoded as `{}` instead.
 */
export async function* textChunks(
	stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, undefined> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let finished = false;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				finished = true;
				break;
			}
			const chunk = decoder.decode(value, { stream: true });
			if (chunk) yield chunk;
		}
		const rest = decoder.decode();
		if (rest) yield rest;
	} finally {
		// Consumer stopped early (client gone): stop the provider stream too.
		if (!finished) await reader.cancel();
	}
}
