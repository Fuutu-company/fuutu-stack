type TextStreamHandlers = {
	/** The text received so far. */
	onText: (text: string) => void;
	/** The full text — with the error if the stream failed. */
	onDone: (text: string, error?: unknown) => void;
};

/** One read of a stream, shared by every subscriber to it. */
type ReadSession = {
	text: string;
	finished: boolean;
	error?: unknown;
	subscribers: Set<TextStreamHandlers>;
	cancel: () => void;
};

const sessions = new WeakMap<ReadableStream<Uint8Array>, ReadSession>();

function startSession(stream: ReadableStream<Uint8Array>): ReadSession {
	const reader = stream.getReader();
	const session: ReadSession = {
		text: "",
		finished: false,
		subscribers: new Set(),
		// A failed stream rejects `cancel` with the error `onDone` already got.
		cancel: () => void reader.cancel().catch(() => undefined),
	};
	const decoder = new TextDecoder();
	void (async () => {
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				session.text += decoder.decode(value, { stream: true });
				for (const s of session.subscribers) s.onText(session.text);
			}
			session.text += decoder.decode();
		} catch (error) {
			session.error = error;
		}
		session.finished = true;
		for (const s of session.subscribers) s.onDone(session.text, session.error);
	})();
	return session;
}

/**
 * Reads a chat reply byte stream as text and returns `stop` for an effect
 * cleanup.
 *
 * StrictMode-safe: dev runs every effect, its cleanup and the effect again.
 * The stream is read once (shared per stream), a re-subscriber gets the
 * text so far, and the stream is cancelled one macrotask after the last
 * subscriber left — only on a real unmount, which also stops the server
 * generating.
 */
export function readTextStream(
	stream: ReadableStream<Uint8Array>,
	handlers: TextStreamHandlers,
): () => void {
	let session = sessions.get(stream);
	if (!session) {
		try {
			session = startSession(stream);
		} catch (error) {
			handlers.onDone("", error);
			return () => {};
		}
		sessions.set(stream, session);
	}
	const current = session;
	if (current.finished) {
		handlers.onDone(current.text, current.error);
		return () => {};
	}
	if (current.text) handlers.onText(current.text);
	current.subscribers.add(handlers);
	return () => {
		current.subscribers.delete(handlers);
		setTimeout(() => {
			if (current.subscribers.size === 0 && !current.finished) {
				current.cancel();
			}
		}, 0);
	};
}
