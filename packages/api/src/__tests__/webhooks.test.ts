import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";
import { webhooksRouter } from "../modules/webhooks/router";

vi.mock("@fuutu/db", () => ({
	createWebhook: vi.fn(),
	listWebhooks: vi.fn(),
	countWebhooks: vi.fn(),
	updateWebhook: vi.fn(),
	deleteWebhook: vi.fn(),
	getWebhook: vi.fn(),
	listDeliveries: vi.fn(),
	countDeliveries: vi.fn(),
	getActiveSubscriptionForOrganization: vi.fn().mockResolvedValue(null),
}));

vi.mock("@fuutu/payments/config.server", () => ({
	getPlanIdForProductId: vi.fn().mockReturnValue("pro"),
}));

vi.mock("@fuutu/auth", () => ({
	auth: {
		api: {
			getFullOrganization: vi.fn(),
		},
	},
}));

vi.mock("@fuutu/ai", () => ({
	resolveAIProvider: vi.fn(),
}));

const {
	createWebhook,
	listWebhooks,
	countWebhooks,
	updateWebhook,
	deleteWebhook,
	getWebhook,
	listDeliveries,
	countDeliveries,
	getActiveSubscriptionForOrganization,
} = await import("@fuutu/db");
const { auth } = await import("@fuutu/auth");

const authenticatedContext = makeSession<Context>(makeUser());
const unauthenticatedContext = makeSession<Context>(null);

const orgFixture = {
	id: "org-1",
	name: "Acme",
	slug: "acme",
	createdAt: new Date("2024-01-01"),
	members: [
		{ userId: "user-1", role: "owner", id: "member-1" },
		{ userId: "user-2", role: "member", id: "member-2" },
	],
	invitations: [],
};

describe("webhooks.create", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
		// Mock a pro subscription so the plan: "pro" check passes
		vi.mocked(getActiveSubscriptionForOrganization).mockResolvedValue({
			productId: "price_pro",
			status: "ACTIVE",
		} as never);
	});

	it("creates a webhook and returns the secret once", async () => {
		vi.mocked(createWebhook).mockResolvedValue({
			id: "wh-1",
			url: "https://example.com/webhook",
			events: ["invoice.created"],
			secret: "whsec_abc123",
			organizationId: "org-1",
			isActive: true,
		} as never);

		const result = await call(
			webhooksRouter.create,
			{
				organizationId: "org-1",
				url: "https://example.com/webhook",
				events: ["invoice.created"],
			},
			{ context: authenticatedContext },
		);

		expect(createWebhook).toHaveBeenCalledWith(
			"org-1",
			"https://example.com/webhook",
			["invoice.created"],
		);
		expect(result).toMatchObject({ id: "wh-1", secret: "whsec_abc123" });
	});

	it("rejects invalid URL", async () => {
		await expect(
			call(
				webhooksRouter.create,
				{ organizationId: "org-1", url: "not-a-url", events: ["test"] },
				{ context: authenticatedContext },
			),
		).rejects.toBeDefined();
	});

	it("rejects empty events array", async () => {
		await expect(
			call(
				webhooksRouter.create,
				{
					organizationId: "org-1",
					url: "https://example.com/webhook",
					events: [],
				},
				{ context: authenticatedContext },
			),
		).rejects.toBeDefined();
	});

	it("rejects empty organizationId", async () => {
		await expect(
			call(
				webhooksRouter.create,
				{
					organizationId: "",
					url: "https://example.com/webhook",
					events: ["test"],
				},
				{ context: authenticatedContext },
			),
		).rejects.toBeDefined();
	});

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(
			call(
				webhooksRouter.create,
				{
					organizationId: "org-1",
					url: "https://example.com/webhook",
					events: ["test"],
				},
				{ context: unauthenticatedContext },
			),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

describe("webhooks.list", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
	});

	it("lists webhooks for an organization", async () => {
		vi.mocked(listWebhooks).mockResolvedValue([
			{ id: "wh-1", url: "https://example.com/webhook", events: ["test"] },
		] as never);
		vi.mocked(countWebhooks).mockResolvedValue(1);

		const result = await call(
			webhooksRouter.list,
			{ organizationId: "org-1" },
			{ context: authenticatedContext },
		);

		expect(listWebhooks).toHaveBeenCalledWith("org-1", {
			take: 50,
			skip: 0,
		});
		expect(result).toEqual({
			items: [
				{ id: "wh-1", url: "https://example.com/webhook", events: ["test"] },
			],
			page: 1,
			limit: 50,
			total: 1,
			totalPages: 1,
		});
	});

	it("returns empty items when no webhooks exist", async () => {
		vi.mocked(listWebhooks).mockResolvedValue([] as never);
		vi.mocked(countWebhooks).mockResolvedValue(0);

		const result = await call(
			webhooksRouter.list,
			{ organizationId: "org-1" },
			{ context: authenticatedContext },
		);

		expect(result).toEqual({
			items: [],
			page: 1,
			limit: 50,
			total: 0,
			totalPages: 1,
		});
	});
});

describe("webhooks.update", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
	});

	it("updates webhook URL and events", async () => {
		vi.mocked(updateWebhook).mockResolvedValue({ count: 1 } as never);

		const result = await call(
			webhooksRouter.update,
			{
				id: "wh-1",
				organizationId: "org-1",
				url: "https://example.com/new-webhook",
				events: ["invoice.created", "invoice.paid"],
			},
			{ context: authenticatedContext },
		);

		expect(updateWebhook).toHaveBeenCalledWith("wh-1", "org-1", {
			url: "https://example.com/new-webhook",
			events: ["invoice.created", "invoice.paid"],
		});
		expect(result).toEqual({ success: true });
	});

	it("updates isActive only", async () => {
		vi.mocked(updateWebhook).mockResolvedValue({ count: 1 } as never);

		await call(
			webhooksRouter.update,
			{ id: "wh-1", organizationId: "org-1", isActive: false },
			{ context: authenticatedContext },
		);

		expect(updateWebhook).toHaveBeenCalledWith("wh-1", "org-1", {
			isActive: false,
		});
	});

	it("rejects invalid URL when provided", async () => {
		await expect(
			call(
				webhooksRouter.update,
				{ id: "wh-1", organizationId: "org-1", url: "not-a-url" },
				{ context: authenticatedContext },
			),
		).rejects.toBeDefined();
	});
});

describe("webhooks.delete", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
	});

	it("deletes a webhook", async () => {
		vi.mocked(deleteWebhook).mockResolvedValue({ id: "wh-1" } as never);

		const result = await call(
			webhooksRouter.delete,
			{ id: "wh-1", organizationId: "org-1" },
			{ context: authenticatedContext },
		);

		expect(deleteWebhook).toHaveBeenCalledWith("wh-1", "org-1");
		expect(result).toEqual({ success: true });
	});

	it("throws NOT_FOUND when webhook does not exist", async () => {
		vi.mocked(deleteWebhook).mockResolvedValue(null as never);

		await expect(
			call(
				webhooksRouter.delete,
				{ id: "wh-404", organizationId: "org-1" },
				{
					context: authenticatedContext,
				},
			),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});

describe("webhooks.deliveries.list", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
		vi.mocked(getWebhook).mockResolvedValue({
			id: "wh-1",
			url: "https://example.com/webhook",
			events: ["test"],
			organizationId: "org-1",
			isActive: true,
		} as never);
	});

	it("lists deliveries for a webhook with pagination", async () => {
		vi.mocked(listDeliveries).mockResolvedValue([
			{ id: "del-1", status: "success", eventType: "invoice.created" },
		] as never);
		vi.mocked(countDeliveries).mockResolvedValue(1);

		const result = await call(
			webhooksRouter.deliveries.list,
			{ webhookId: "wh-1", organizationId: "org-1", page: 1, limit: 10 },
			{ context: authenticatedContext },
		);

		expect(listDeliveries).toHaveBeenCalledWith("wh-1", { take: 10, skip: 0 });
		expect(countDeliveries).toHaveBeenCalledWith("wh-1");
		expect(result).toEqual({
			items: [{ id: "del-1", status: "success", eventType: "invoice.created" }],
			page: 1,
			limit: 10,
			total: 1,
			totalPages: 1,
		});
	});

	it("computes correct skip for page 2", async () => {
		vi.mocked(listDeliveries).mockResolvedValue([] as never);
		vi.mocked(countDeliveries).mockResolvedValue(0);

		await call(
			webhooksRouter.deliveries.list,
			{ webhookId: "wh-1", organizationId: "org-1", page: 2, limit: 20 },
			{ context: authenticatedContext },
		);

		expect(listDeliveries).toHaveBeenCalledWith("wh-1", { take: 20, skip: 20 });
	});

	it("rejects limit exceeding 100", async () => {
		await expect(
			call(
				webhooksRouter.deliveries.list,
				{ webhookId: "wh-1", organizationId: "org-1", limit: 101 },
				{ context: authenticatedContext },
			),
		).rejects.toBeDefined();
	});
});
