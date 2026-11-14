import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";

/**
 * Org conversations: owning the conversation is not enough — the caller
 * must still be a member of its organization with the chat permission.
 * An ex-member who still owns an org conversation cannot read, stream
 * into (and bill the org for) or delete it.
 */

const mocks = vi.hoisted(() => ({
	getConversation: vi.fn(),
	getConversationScope: vi.fn(),
	addMessage: vi.fn(),
	listMessages: vi.fn(),
	countMessages: vi.fn(),
	deleteConversation: vi.fn(),
	getCreditBalance: vi.fn(),
	getActiveCreditPackages: vi.fn(),
	consumeCreditsTx: vi.fn(),
	resolveAIProvider: vi.fn(),
	getFullOrganization: vi.fn(),
}));

vi.mock("@fuutu/ai", () => ({ resolveAIProvider: mocks.resolveAIProvider }));
vi.mock("@fuutu/db", () => ({
	getConversation: mocks.getConversation,
	getConversationScope: mocks.getConversationScope,
	addMessage: mocks.addMessage,
	listMessages: mocks.listMessages,
	countMessages: mocks.countMessages,
	deleteConversation: mocks.deleteConversation,
	getCreditBalance: mocks.getCreditBalance,
	getActiveCreditPackages: mocks.getActiveCreditPackages,
	consumeCreditsTx: mocks.consumeCreditsTx,
}));
vi.mock("@fuutu/auth", () => ({
	auth: { api: { getFullOrganization: mocks.getFullOrganization } },
}));

const { listMessagesProcedure } = await import(
	"../modules/chat/messages/procedures/list"
);
const { streamMessageProcedure } = await import(
	"../modules/chat/messages/procedures/stream"
);
const { deleteConversationProcedure } = await import(
	"../modules/chat/conversations/procedures/delete"
);

const context = makeSession<Context>(makeUser({ id: "user-1" }));

const ORG_ID = "12345678-1234-1234-8123-123456789abc";

const orgWith = (members: { userId: string; role: string }[]) => ({
	id: ORG_ID,
	name: "Acme",
	slug: "acme",
	createdAt: new Date("2024-01-01"),
	members: members.map((m, i) => ({ ...m, id: `member-${i}` })),
	invitations: [],
});

const EX_MEMBER_ORG = orgWith([{ userId: "user-other", role: "owner" }]);
const MEMBER_ORG = orgWith([{ userId: "user-1", role: "member" }]);

function textStream(text: string): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			controller.enqueue(new TextEncoder().encode(text));
			controller.close();
		},
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.getConversationScope.mockResolvedValue({
		id: "c-org",
		organizationId: ORG_ID,
	});
	mocks.getConversation.mockResolvedValue({
		id: "c-org",
		organizationId: ORG_ID,
		messages: [],
	});
	mocks.listMessages.mockResolvedValue([]);
	mocks.countMessages.mockResolvedValue(0);
	mocks.deleteConversation.mockResolvedValue({ id: "c-org" });
	mocks.addMessage.mockResolvedValue({ id: "m-1" });
	mocks.getCreditBalance.mockResolvedValue(null);
	mocks.getActiveCreditPackages.mockResolvedValue([]);
	mocks.consumeCreditsTx.mockResolvedValue({
		ok: true,
		consumed: 1,
		remaining: 0,
		source: "overage",
	});
	mocks.resolveAIProvider.mockReturnValue({
		id: "noop",
		chat: vi.fn(),
		stream: vi.fn(async () => textStream("Hello")),
	});
	mocks.getFullOrganization.mockResolvedValue(EX_MEMBER_ORG);
});

describe("chat.messages.list — org conversations", () => {
	it("forbids an ex-member and reads no messages", async () => {
		await expect(
			call(listMessagesProcedure, { conversationId: "c-org" }, { context }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(mocks.getConversationScope).toHaveBeenCalledWith("c-org", "user-1");
		expect(mocks.listMessages).not.toHaveBeenCalled();
		expect(mocks.countMessages).not.toHaveBeenCalled();
	});

	it("lets a current member read", async () => {
		mocks.getFullOrganization.mockResolvedValue(MEMBER_ORG);
		const result = await call(
			listMessagesProcedure,
			{ conversationId: "c-org" },
			{ context },
		);
		expect(result.total).toBe(0);
		expect(mocks.listMessages).toHaveBeenCalled();
	});

	it("needs no org lookup for a personal conversation", async () => {
		mocks.getConversationScope.mockResolvedValue({
			id: "c-own",
			organizationId: null,
		});
		await call(listMessagesProcedure, { conversationId: "c-own" }, { context });
		expect(mocks.getFullOrganization).not.toHaveBeenCalled();
		expect(mocks.listMessages).toHaveBeenCalled();
	});

	it("answers 404 for a missing or foreign conversation", async () => {
		mocks.getConversationScope.mockResolvedValue(null);
		await expect(
			call(listMessagesProcedure, { conversationId: "c-x" }, { context }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(mocks.listMessages).not.toHaveBeenCalled();
	});
});

describe("chat.messages.stream — org conversations", () => {
	it("forbids an ex-member: no message saved, no provider call, no org credits", async () => {
		await expect(
			call(
				streamMessageProcedure,
				{ conversationId: "c-org", content: "Hi" },
				{ context },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(mocks.addMessage).not.toHaveBeenCalled();
		expect(mocks.resolveAIProvider).not.toHaveBeenCalled();
		expect(mocks.getCreditBalance).not.toHaveBeenCalled();
		expect(mocks.consumeCreditsTx).not.toHaveBeenCalled();
	});

	it("lets a current member stream and bills the org", async () => {
		mocks.getFullOrganization.mockResolvedValue(MEMBER_ORG);
		const reply = await call(
			streamMessageProcedure,
			{ conversationId: "c-org", content: "Hi" },
			{ context },
		);
		const chunks: string[] = [];
		for await (const chunk of reply) chunks.push(chunk);
		expect(chunks).toEqual(["Hello"]);
		expect(mocks.consumeCreditsTx).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: ORG_ID }),
		);
	});
});

describe("chat.conversations.delete — org conversations", () => {
	it("forbids an ex-member and deletes nothing", async () => {
		await expect(
			call(
				deleteConversationProcedure,
				{ conversationId: "c-org" },
				{ context },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(mocks.deleteConversation).not.toHaveBeenCalled();
	});

	it("lets a current member delete", async () => {
		mocks.getFullOrganization.mockResolvedValue(MEMBER_ORG);
		await expect(
			call(
				deleteConversationProcedure,
				{ conversationId: "c-org" },
				{ context },
			),
		).resolves.toEqual({ success: true });
	});

	it("answers 404 for a missing or foreign conversation", async () => {
		mocks.getConversationScope.mockResolvedValue(null);
		await expect(
			call(deleteConversationProcedure, { conversationId: "c-x" }, { context }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(mocks.deleteConversation).not.toHaveBeenCalled();
	});
});
