import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";
import { searchRouter } from "../modules/search/router";

vi.mock("@fuutu/db", () => ({
	getOrganizationWithMembers: vi.fn(),
	getActiveSubscriptionForUser: vi.fn().mockResolvedValue(null),
	getActiveSubscriptionForOrganization: vi.fn().mockResolvedValue(null),
}));

vi.mock("@fuutu/auth", () => ({
	auth: {
		api: {
			getFullOrganization: vi.fn(),
		},
	},
}));

vi.mock("@fuutu/search", () => ({
	resolveSearchProvider: vi.fn(),
}));

const { auth } = await import("@fuutu/auth");
const { resolveSearchProvider } = await import("@fuutu/search");

const authenticatedContext = makeSession<Context>(makeUser());
const unauthenticatedContext = makeSession<Context>(null);

const ORG_ID = "00000000-0000-4000-8000-0000000000aa";

const orgFixture = {
	id: ORG_ID,
	name: "Acme",
	slug: "acme",
	members: [
		{ userId: "user-1", role: "owner", id: "member-1" },
		{ userId: "user-2", role: "member", id: "member-2" },
	],
};

const mockProvider = { id: "postgres", search: vi.fn(), index: vi.fn() };

describe("search.search", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(resolveSearchProvider).mockReturnValue(mockProvider as never);
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
		mockProvider.search.mockResolvedValue([]);
	});

	it("rejects unauthenticated requests", async () => {
		await expect(
			call(
				searchRouter.search,
				{ text: "x" },
				{ context: unauthenticatedContext },
			),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("scopes unscoped queries to the caller's userId", async () => {
		await call(
			searchRouter.search,
			{ text: "invoice" },
			{ context: authenticatedContext },
		);
		expect(mockProvider.search).toHaveBeenCalledWith(
			expect.objectContaining({
				text: "invoice",
				userId: "user-1",
			}),
		);
		expect(mockProvider.search.mock.calls[0]?.[0]).not.toHaveProperty(
			"organizationId",
		);
	});

	it("pins organizationId queries to org audit-logs after permission check", async () => {
		await call(
			searchRouter.search,
			{ text: "member", organizationId: ORG_ID, collection: "notifications" },
			{ context: authenticatedContext },
		);
		// collection is forced to audit-logs — org members must never read
		// another user's notifications via the org path.
		expect(mockProvider.search).toHaveBeenCalledWith(
			expect.objectContaining({
				collection: "audit-logs",
				organizationId: ORG_ID,
			}),
		);
	});

	it("rejects org search for members without AUDIT_LOG.VIEW", async () => {
		const memberContext = makeSession<Context>(
			makeUser({ id: "user-2" } as never),
		);
		await expect(
			call(
				searchRouter.search,
				{ text: "x", organizationId: ORG_ID },
				{ context: memberContext },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(mockProvider.search).not.toHaveBeenCalled();
	});
});
