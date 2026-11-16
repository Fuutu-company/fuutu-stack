import { makeSession, makeUser } from "@fuutu/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";

/**
 * The chat procedures through the real RPC handler — what the browser
 * receives. `call()` skips serialisation, so it hid that a returned
 * `Response` went out as `{"json":{}}` (application/json) instead of the
 * streamed text.
 */

const mocks = vi.hoisted(() => ({
	getConversation: vi.fn(),
	addMessage: vi.fn(),
	resolveAIProvider: vi.fn(),
	consumeCreditsTx: vi.fn(),
	logError: vi.fn(),
}));

vi.mock("@fuutu/ai", () => ({ resolveAIProvider: mocks.resolveAIProvider }));
vi.mock("@fuutu/db", () => ({
	getConversation: mocks.getConversation,
	addMessage: mocks.addMessage,
	verifyApiKeyWithOwner: vi.fn(),
	getCreditBalance: vi.fn(async () => null),
	getActiveCreditPackages: vi.fn(async () => []),
	consumeCreditsTx: mocks.consumeCreditsTx,
}));
vi.mock("@fuutu/logs", () => ({
	createLogger: ({ scope }: { scope: string }) => ({
		info: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
		error: (message: string, meta?: unknown) =>
			mocks.logError(scope, message, meta),
	}),
}));
vi.mock("@fuutu/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("../orpc/openapi-merge", () => ({
	getBetterAuthSpecPaths: vi.fn(async () => ({})),
	getBetterAuthSpecSchemas: vi.fn(async () => ({})),
}));
vi.mock("../orpc/router", async () => {
	const { streamMessageProcedure } = await import(
		"../modules/chat/messages/procedures/stream"
	);
	const { chat } = await import("../modules/ai/procedures/chat");
	return {
		router: {
			chat: { messages: { stream: streamMessageProcedure } },
			ai: { chat },
		},
	};
});

const { rpcHandler } = await import("../orpc/handler");

// Kit suite: the credits module on — an app may ship config.features.credits off.
(await import("@fuutu/payments/config")).paymentsConfig.creditsEnabled = true;

const context = makeSession<Context>(makeUser({ id: "user-1" }));

function textStream(...chunks: string[]): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(new TextEncoder().encode(chunk));
			}
			controller.close();
		},
	});
}

async function post(path: string, json: unknown) {
	const { matched, response } = await rpcHandler.handle(
		new Request(`http://localhost/api/rpc/${path}`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ json }),
		}),
		{ prefix: "/api/rpc", context: { ...context } },
	);
	expect(matched).toBe(true);
	if (!response) throw new Error("no response");
	return response;
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.resolveAIProvider.mockReturnValue({
		id: "noop",
		chat: vi.fn(),
		stream: vi.fn(async () => textStream("Hello", ", world")),
	});
	mocks.getConversation.mockResolvedValue({ id: "c-1", messages: [] });
	mocks.addMessage.mockResolvedValue({ id: "m-1" });
	mocks.consumeCreditsTx.mockResolvedValue({
		ok: true,
		consumed: 1,
		remaining: 0,
		source: "overage",
	});
});

/**
 * Sends `first`, then waits: fails with `failure` when given (a provider
 * error mid-stream), else stays open until cancelled. `cancelled` resolves
 * when the consumer cancels it.
 */
function stalledStream(first: string, failure?: Error) {
	let onCancel: () => void = () => {};
	const cancelled = new Promise<void>((resolve) => {
		onCancel = resolve;
	});
	let sent = false;
	const stream = new ReadableStream<Uint8Array>({
		pull(controller) {
			if (!sent) {
				sent = true;
				controller.enqueue(new TextEncoder().encode(first));
				return;
			}
			if (failure) controller.error(failure);
			return new Promise<void>(() => {});
		},
		cancel() {
			onCancel();
		},
	});
	return { stream, cancelled };
}

function useProviderStream(stream: ReadableStream<Uint8Array>) {
	mocks.resolveAIProvider.mockReturnValue({
		id: "noop",
		chat: vi.fn(),
		stream: vi.fn(async () => stream),
	});
}

describe("chat.messages.stream over RPC", () => {
	it("streams the provider text as an event stream, not an empty JSON body", async () => {
		const response = await post("chat/messages/stream", {
			conversationId: "c-1",
			content: "Hi",
		});
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/event-stream");
		const body = await response.text();
		expect(body).toContain('"Hello"');
		expect(body).toContain('", world"');
	});

	it("saves the user message and the full assistant reply", async () => {
		const response = await post("chat/messages/stream", {
			conversationId: "c-1",
			content: "Hi",
		});
		await response.text();
		expect(mocks.addMessage).toHaveBeenCalledWith(
			"c-1",
			"user-1",
			"user",
			"Hi",
		);
		expect(mocks.addMessage).toHaveBeenCalledWith(
			"c-1",
			"user-1",
			"assistant",
			"Hello, world",
		);
	});

	it("answers 404 for another user's conversation and calls no provider", async () => {
		mocks.getConversation.mockResolvedValue(null);
		const response = await post("chat/messages/stream", {
			conversationId: "c-foreign",
			content: "Hi",
		});
		expect(response.status).toBe(404);
		expect(mocks.resolveAIProvider).not.toHaveBeenCalled();
		expect(mocks.addMessage).not.toHaveBeenCalled();
	});

	it("on a client abort cancels the provider and saves the partial reply", async () => {
		const provider = stalledStream("Partial");
		useProviderStream(provider.stream);
		const response = await post("chat/messages/stream", {
			conversationId: "c-1",
			content: "Hi",
		});
		const reader = response.body?.getReader();
		if (!reader) throw new Error("no body");
		let received = "";
		while (!received.includes('"Partial"')) {
			const { value, done } = await reader.read();
			if (done) break;
			received += new TextDecoder().decode(value);
		}
		await reader.cancel();

		await provider.cancelled;
		await vi.waitFor(() =>
			expect(mocks.addMessage).toHaveBeenCalledWith(
				"c-1",
				"user-1",
				"assistant",
				"Partial",
			),
		);
		// "Hi" → 1 prompt token, "Partial" → 2 reply tokens.
		await vi.waitFor(() =>
			expect(mocks.consumeCreditsTx).toHaveBeenCalledWith(
				expect.objectContaining({
					amount: 3,
					idempotencyKey: "chat-reply:m-1",
				}),
			),
		);
	});

	it("on a provider error mid-stream sends a generic error event and saves the partial reply", async () => {
		const provider = stalledStream(
			"Partial",
			new Error("upstream 500: secret-internal-detail"),
		);
		useProviderStream(provider.stream);
		const response = await post("chat/messages/stream", {
			conversationId: "c-1",
			content: "Hi",
		});
		const body = await response.text();
		expect(body).toContain('"Partial"');
		expect(body).toContain("event: error");
		expect(body).toContain("Internal server error");
		expect(body).not.toContain("secret-internal-detail");
		expect(mocks.addMessage).toHaveBeenCalledWith(
			"c-1",
			"user-1",
			"assistant",
			"Partial",
		);
		expect(mocks.logError).toHaveBeenCalledWith(
			"chat-stream",
			expect.any(String),
			expect.anything(),
		);
		expect(mocks.consumeCreditsTx).toHaveBeenCalledTimes(1);
		expect(mocks.consumeCreditsTx).toHaveBeenCalledWith(
			expect.objectContaining({ amount: 3 }),
		);
	});
});

describe("ai.chat over RPC", () => {
	it("streams the provider text as an event stream", async () => {
		const response = await post("ai/chat", {
			messages: [{ role: "user", content: "Hi" }],
		});
		expect(response.headers.get("content-type")).toContain("text/event-stream");
		const body = await response.text();
		expect(body).toContain('"Hello"');
		expect(body).toContain('", world"');
	});

	it("logs a provider error mid-stream and sends a generic error event", async () => {
		const provider = stalledStream(
			"Partial",
			new Error("upstream 500: secret-internal-detail"),
		);
		useProviderStream(provider.stream);
		const response = await post("ai/chat", {
			messages: [{ role: "user", content: "Hi" }],
		});
		const body = await response.text();
		expect(body).toContain("event: error");
		expect(body).toContain("Internal server error");
		expect(body).not.toContain("secret-internal-detail");
		expect(mocks.logError).toHaveBeenCalledWith(
			"ai-chat",
			expect.any(String),
			expect.objectContaining({ err: expect.any(Error) }),
		);
	});
});
