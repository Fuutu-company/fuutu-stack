import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";
import { chat } from "../modules/ai/procedures/chat";

vi.mock("@fuutu/ai", () => ({
	resolveAIProvider: vi.fn(),
}));

vi.mock("@fuutu/db", () => ({
	db: {},
}));

const { resolveAIProvider } = await import("@fuutu/ai");

type ChatRole = "user" | "assistant" | "system";

const authenticatedContext = makeSession<Context>(makeUser());
const unauthenticatedContext = makeSession<Context>(null);

const fakeStreamResponse = {
	status: 200,
	headers: new Headers({ "content-type": "text/event-stream" }),
	body: new ReadableStream({
		start(controller) {
			controller.enqueue(new TextEncoder().encode("data: Hello\n\n"));
			controller.close();
		},
	}),
};

function msg(role: ChatRole, content: string) {
	return { role, content };
}

function mockProviderStream() {
	vi.mocked(resolveAIProvider).mockReturnValue({
		id: "noop",
		stream: vi.fn().mockResolvedValue(fakeStreamResponse.body),
		chat: vi.fn(),
	} as never);
}

describe("ai.chat", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns a streaming response for valid messages", async () => {
		mockProviderStream();

		const messages = [msg("user", "Hello, what is Fuutu Stack?")];

		const result = await call(
			chat,
			{ messages },
			{ context: authenticatedContext },
		);

		expect(resolveAIProvider).toHaveBeenCalled();
		expect(result).toBeInstanceOf(Response);
	});

	it("passes multiple messages to the streaming provider", async () => {
		mockProviderStream();

		const messages = [
			msg("system", "You are a helpful assistant."),
			msg("user", "What plans are available?"),
		];

		await call(chat, { messages }, { context: authenticatedContext });

		expect(resolveAIProvider).toHaveBeenCalled();
	});

	it("rejects an empty messages array", async () => {
		await expect(
			call(chat, { messages: [] }, { context: authenticatedContext }),
		).rejects.toBeDefined();
	});

	it("rejects messages exceeding the max of 50", async () => {
		const messages = Array.from({ length: 51 }, () => msg("user", "msg"));

		await expect(
			call(chat, { messages }, { context: authenticatedContext }),
		).rejects.toBeDefined();
	});

	it("rejects content exceeding 10000 characters", async () => {
		await expect(
			call(
				chat,
				{ messages: [msg("user", "x".repeat(10001))] },
				{ context: authenticatedContext },
			),
		).rejects.toBeDefined();
	});

	it("rejects an invalid role", async () => {
		await expect(
			call(chat, { messages: [{ role: "tool", content: "x" }] } as never, {
				context: authenticatedContext,
			}),
		).rejects.toBeDefined();
	});

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(
			call(
				chat,
				{ messages: [msg("user", "Hello")] },
				{ context: unauthenticatedContext },
			),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});
