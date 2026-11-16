import { getMeter } from "@fuutu/credits";
import { makeSession, makeUser } from "@fuutu/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";

/**
 * AI chat metering on the `ai_tokens` meter, through the real RPC handler
 * and the real `@fuutu/credits` (only the DB is faked): check before the
 * provider is called, consume after the reply — one idempotent consume per
 * reply. Tokens are estimated as ceil(characters / 4) of prompt + reply.
 */

const mocks = vi.hoisted(() => ({
	getConversation: vi.fn(),
	addMessage: vi.fn(),
	resolveAIProvider: vi.fn(),
	getCreditBalance: vi.fn(),
	getActiveCreditPackages: vi.fn(),
	consumeCreditsTx: vi.fn(),
	getFullOrganization: vi.fn(),
}));

vi.mock("@fuutu/ai", () => ({ resolveAIProvider: mocks.resolveAIProvider }));
vi.mock("@fuutu/db", () => ({
	getConversation: mocks.getConversation,
	addMessage: mocks.addMessage,
	getCreditBalance: mocks.getCreditBalance,
	getActiveCreditPackages: mocks.getActiveCreditPackages,
	consumeCreditsTx: mocks.consumeCreditsTx,
	verifyApiKeyWithOwner: vi.fn(),
}));
vi.mock("@fuutu/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn(),
			getFullOrganization: mocks.getFullOrganization,
		},
	},
}));
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
const { paymentsConfig } = await import("@fuutu/payments/config");

/** 40 characters → 10 prompt tokens. */
const PROMPT = "x".repeat(40);
/** "Hello" + ", world" = 12 characters → 3 reply tokens. */
const REPLY_TOKENS = 3;
const PROMPT_TOKENS = 10;

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

let requestCount = 0;

/** A fresh user per request keeps the per-user `aiChat` rate limit out of the way. */
async function post(path: string, json: unknown, userId = "user-1") {
	requestCount += 1;
	const context = makeSession<Context>(makeUser({ id: userId }));
	const { response } = await rpcHandler.handle(
		new Request(`http://localhost/api/rpc/${path}`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-forwarded-for": `10.0.0.${requestCount}`,
			},
			body: JSON.stringify({ json }),
		}),
		{ prefix: "/api/rpc", context: { ...context } },
	);
	if (!response) throw new Error("no response");
	return response;
}

const sendChat = () =>
	post("chat/messages/stream", { conversationId: "c-1", content: PROMPT });

const aiMeter = getMeter("ai_tokens");
const kitAllowOverage = aiMeter?.allowOverage;
const kitCreditsEnabled = paymentsConfig.creditsEnabled;

beforeEach(() => {
	vi.clearAllMocks();
	paymentsConfig.creditsEnabled = true;
	mocks.resolveAIProvider.mockReturnValue({
		id: "noop",
		chat: vi.fn(),
		stream: vi.fn(async () => textStream("Hello", ", world")),
	});
	mocks.getConversation.mockResolvedValue({
		id: "c-1",
		organizationId: null,
		messages: [],
	});
	mocks.addMessage.mockImplementation(async (_c, _u, role: string) => ({
		id: role === "user" ? "m-user-1" : "m-assistant-1",
	}));
	mocks.getCreditBalance.mockResolvedValue({
		recurringGranted: 1000,
		recurringConsumed: 0,
	});
	mocks.getActiveCreditPackages.mockResolvedValue([]);
	mocks.consumeCreditsTx.mockResolvedValue({
		ok: true,
		consumed: PROMPT_TOKENS + REPLY_TOKENS,
		remaining: 987,
		source: "recurring",
	});
});

afterEach(() => {
	if (aiMeter) aiMeter.allowOverage = kitAllowOverage;
	paymentsConfig.creditsEnabled = kitCreditsEnabled;
});

describe("chat.messages.stream — credits", () => {
	it("checks the user's balance, streams, then consumes prompt + reply tokens once", async () => {
		const response = await sendChat();
		expect(response.status).toBe(200);
		expect(await response.text()).toContain('", world"');

		expect(mocks.getCreditBalance).toHaveBeenCalledWith({
			userId: "user-1",
			organizationId: undefined,
			meterKey: "ai_tokens",
		});
		expect(mocks.consumeCreditsTx).toHaveBeenCalledTimes(1);
		expect(mocks.consumeCreditsTx).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: "user-1",
				organizationId: undefined,
				meterKey: "ai_tokens",
				amount: 13,
				idempotencyKey: "chat-reply:m-user-1",
				allowOverage: true,
			}),
		);
	});

	it("meters an organization conversation against the organization", async () => {
		mocks.getConversation.mockResolvedValue({
			id: "c-1",
			organizationId: "org-1",
			messages: [],
		});
		mocks.getFullOrganization.mockResolvedValue({
			id: "org-1",
			members: [{ id: "member-1", userId: "user-1", role: "member" }],
		});
		const response = await sendChat();
		await response.text();
		expect(mocks.getCreditBalance).toHaveBeenCalledWith({
			userId: undefined,
			organizationId: "org-1",
			meterKey: "ai_tokens",
		});
		expect(mocks.consumeCreditsTx).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: "org-1", userId: undefined }),
		);
	});

	it("answers 402 without calling the provider or saving when the meter blocks", async () => {
		if (aiMeter) aiMeter.allowOverage = false;
		mocks.getCreditBalance.mockResolvedValue({
			recurringGranted: 100,
			recurringConsumed: 95,
		});
		const response = await sendChat();
		expect(response.status).toBe(402);
		const body = await response.text();
		expect(body).toContain("PAYMENT_REQUIRED");
		expect(body).toContain('"meterKey":"ai_tokens"');
		expect(mocks.resolveAIProvider).not.toHaveBeenCalled();
		expect(mocks.addMessage).not.toHaveBeenCalled();
		expect(mocks.consumeCreditsTx).not.toHaveBeenCalled();
	});

	it("keeps answering past the balance when the meter allows overage, and records it", async () => {
		mocks.getCreditBalance.mockResolvedValue({
			recurringGranted: 100,
			recurringConsumed: 100,
		});
		mocks.consumeCreditsTx.mockResolvedValue({
			ok: true,
			consumed: 13,
			remaining: -13,
			source: "overage",
		});
		const response = await sendChat();
		expect(response.status).toBe(200);
		expect(await response.text()).toContain('"Hello"');
		expect(mocks.consumeCreditsTx).toHaveBeenCalledWith(
			expect.objectContaining({ amount: 13, allowOverage: true }),
		);
	});

	it("consumes nothing when the provider sent no text", async () => {
		mocks.resolveAIProvider.mockReturnValue({
			id: "noop",
			chat: vi.fn(),
			stream: vi.fn(async () => textStream()),
		});
		const response = await sendChat();
		await response.text();
		expect(mocks.consumeCreditsTx).not.toHaveBeenCalled();
	});

	it("skips metering entirely when credits are disabled", async () => {
		paymentsConfig.creditsEnabled = false;
		if (aiMeter) aiMeter.allowOverage = false;
		mocks.getCreditBalance.mockResolvedValue(null);
		const response = await sendChat();
		expect(response.status).toBe(200);
		await response.text();
		expect(mocks.getCreditBalance).not.toHaveBeenCalled();
		expect(mocks.consumeCreditsTx).not.toHaveBeenCalled();
	});
});

describe("ai.chat — credits", () => {
	const sendAi = (userId: string) =>
		post("ai/chat", { messages: [{ role: "user", content: PROMPT }] }, userId);

	it("meters the caller and consumes prompt + reply tokens", async () => {
		const response = await sendAi("user-ai");
		expect(response.status).toBe(200);
		await response.text();
		expect(mocks.consumeCreditsTx).toHaveBeenCalledTimes(1);
		expect(mocks.consumeCreditsTx).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: "user-ai",
				meterKey: "ai_tokens",
				amount: 13,
			}),
		);
	});

	it("uses a distinct idempotency key per request", async () => {
		await (await sendAi("user-ai")).text();
		await (await sendAi("user-ai")).text();
		const keys = mocks.consumeCreditsTx.mock.calls.map(
			([params]) => (params as { idempotencyKey?: string }).idempotencyKey,
		);
		expect(keys).toHaveLength(2);
		expect(keys[0]).toMatch(/^ai-chat:/);
		expect(keys[0]).not.toBe(keys[1]);
	});

	it("answers 402 without calling the provider when the meter blocks", async () => {
		if (aiMeter) aiMeter.allowOverage = false;
		mocks.getCreditBalance.mockResolvedValue(null);
		const response = await sendAi("user-ai-blocked");
		expect(response.status).toBe(402);
		expect(mocks.resolveAIProvider).not.toHaveBeenCalled();
	});
});
