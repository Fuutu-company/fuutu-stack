import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * The chat reply reader (`ChatStreamingText` → `readTextStream`) must
 * survive React StrictMode: dev mounts, unmounts and remounts every effect
 * once. The old effect cancelled the one-shot reply stream in that first
 * cleanup (and kept its lock), so in dev no reply ever rendered. A real
 * unmount still cancels the stream so the server stops generating.
 */

const ROOT = join(import.meta.dirname, "../../../..");
// Non-literal path: an app module outside this package's tsc project.
const MODULE = join(
	ROOT,
	"apps/saas/src/modules/app/chat/lib/read-text-stream.ts",
);
const { readTextStream } = (await import(/* @vite-ignore */ MODULE)) as {
	readTextStream: (
		stream: ReadableStream<Uint8Array>,
		handlers: {
			onText: (text: string) => void;
			onDone: (text: string, error?: unknown) => void;
		},
	) => () => void;
};

/** A reply stream that hands out one chunk per pull, like the oRPC adapter. */
function replyStream(chunks: string[]) {
	const cancel = vi.fn();
	const queue = [...chunks];
	const stream = new ReadableStream<Uint8Array>({
		async pull(controller) {
			await new Promise((resolve) => setTimeout(resolve, 1));
			const next = queue.shift();
			if (next === undefined) controller.close();
			else controller.enqueue(new TextEncoder().encode(next));
		},
		cancel,
	});
	return { stream, cancel };
}

function handlers() {
	const texts: string[] = [];
	let resolveDone: (value: { text: string; error?: unknown }) => void =
		() => {};
	const done = new Promise<{ text: string; error?: unknown }>((resolve) => {
		resolveDone = resolve;
	});
	return {
		texts,
		done,
		onText: (text: string) => texts.push(text),
		onDone: (text: string, error?: unknown) => resolveDone({ text, error }),
	};
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("readTextStream", () => {
	it("reports the growing text and the full reply at the end", async () => {
		const { stream } = replyStream(["Hello", ", world"]);
		const h = handlers();
		readTextStream(stream, h);
		expect(await h.done).toEqual({ text: "Hello, world", error: undefined });
		expect(h.texts).toEqual(["Hello", "Hello, world"]);
	});

	it("survives StrictMode's stop + immediate re-read (no reply lost)", async () => {
		const { stream, cancel } = replyStream(["Hello", ", world"]);
		const first = handlers();
		const stop = readTextStream(stream, first);
		stop();
		const second = handlers();
		readTextStream(stream, second);
		expect(await second.done).toEqual({
			text: "Hello, world",
			error: undefined,
		});
		expect(cancel).not.toHaveBeenCalled();
	});

	it("keeps a chunk the first (StrictMode) reader already received", async () => {
		// The chunk is queued before anyone reads (pull runs eagerly), so the
		// first reader's read() resolves with it right away.
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("Streamed "));
			},
			async pull(controller) {
				await new Promise((resolve) => setTimeout(resolve, 1));
				controller.enqueue(new TextEncoder().encode("reply."));
				controller.close();
			},
		});
		const stop = readTextStream(stream, handlers());
		await Promise.resolve();
		stop();
		const second = handlers();
		readTextStream(stream, second);
		expect(await second.done).toEqual({
			text: "Streamed reply.",
			error: undefined,
		});
	});

	it("cancels the stream on a real unmount and reports nothing more", async () => {
		const { stream, cancel } = replyStream(["Hello", ", world", "!"]);
		const h = handlers();
		const onDone = vi.fn(h.onDone);
		const stop = readTextStream(stream, { ...h, onDone });
		stop();
		await tick();
		expect(cancel).toHaveBeenCalledTimes(1);
		expect(onDone).not.toHaveBeenCalled();
	});

	it("ends with the partial text and the error when the stream fails", async () => {
		const failure = new Error("network");
		let sent = false;
		const stream = new ReadableStream<Uint8Array>({
			pull(controller) {
				if (sent) return controller.error(failure);
				sent = true;
				controller.enqueue(new TextEncoder().encode("Part"));
			},
		});
		const h = handlers();
		readTextStream(stream, h);
		expect(await h.done).toEqual({ text: "Part", error: failure });
	});
});
