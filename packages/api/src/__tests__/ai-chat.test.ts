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
	getCreditBalance: vi.fn(async () => null),
	// A paying owner: null balances run on overage, which needs a paid plan.
	getActiveSubscriptionForUser: vi.fn(async () => ({
		status: "ACTIVE",
		productId: "prod-pro",
		priceId: "price-pro",
	})),
	getActiveSubscriptionForOrganization: vi.fn(async () => ({
		status: "ACTIVE",
		productId: "prod-pro",
		priceId: "price-pro",
	})),
	getActiveSubscriptionsForOwner: vi.fn(async () => []),
	getActiveCreditPackages: vi.fn(async () => []),
	consumeCreditsTx: vi.fn(async () => ({
		ok: true,
		consumed: 1,
		remaining: 0,
		source: "overage",
	})),
}));

const { resolveAIProvider } = await import("@fuutu/ai");

type ChatRole = "user" | "assistant";

const authenticatedContext = makeSession<Context>(makeUser());
const unauthenticatedContext = makeSession<Context>(null);

const fakeStreamResponse = {
	status: 200,
	headers: new Headers({ "content-type": "text/plain; charset=utf-8" }),
	body: new ReadableStream({
		start(controller) {
			controller.enqueue(new TextEncoder().encode("Hello"));
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
		// Provider text chunks as an async iterator — oRPC sends it as an
		// event stream (a returned Response would go out as `{}`).
		const chunks: string[] = [];
		for await (const chunk of result) chunks.push(chunk);
		expect(chunks).toEqual(["Hello"]);
	});

	it("passes multiple messages to the streaming provider", async () => {
		mockProviderStream();

		const messages = [
			msg("user", "What plans are available?"),
			msg("assistant", "Free, Pro and Enterprise."),
			msg("user", "Which one includes webhooks?"),
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
