import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";

// Webhook creation is gated by the `api.webhooks` feature in
// FEATURE_CATALOG, not by a hard-coded tier id. Move the feature to the
// enterprise tier and a pro org must be turned away.
vi.mock("@fuutu/payments/config", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@fuutu/payments/config")>();
	return {
		...actual,
		FEATURE_CATALOG: {
			...actual.FEATURE_CATALOG,
			api: {
				...actual.FEATURE_CATALOG.api,
				webhooks: { tier: "enterprise", limitKey: "webhooks" },
			},
		},
	};
});

vi.mock("@fuutu/db", () => ({
	createWebhookWithinLimit: vi.fn(),
	countWebhooks: vi.fn().mockResolvedValue(0),
	getActiveSubscriptionForOrganization: vi.fn(),
}));

vi.mock("@fuutu/payments/config.server", () => ({
	getPlanIdForProductId: vi.fn().mockReturnValue("pro"),
}));

vi.mock("@fuutu/auth", () => ({
	auth: { api: { getFullOrganization: vi.fn() } },
}));

vi.mock("@fuutu/ai", () => ({ resolveAIProvider: vi.fn() }));

const { createWebhookWithinLimit, getActiveSubscriptionForOrganization } =
	await import("@fuutu/db");
const { auth } = await import("@fuutu/auth");
const { webhooksRouter } = await import("../modules/webhooks/router");

const context = makeSession<Context>(makeUser());

describe("webhooks.create — feature gate", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue({
			id: "org-1",
			members: [{ userId: "user-1", role: "owner", id: "member-1" }],
		} as never);
		vi.mocked(getActiveSubscriptionForOrganization).mockResolvedValue({
			productId: "price_pro",
			status: "ACTIVE",
		} as never);
	});

	it("rejects a pro org when the webhooks feature requires enterprise", async () => {
		await expect(
			call(
				webhooksRouter.create,
				{
					organizationId: "org-1",
					url: "https://example.com/webhook",
					events: ["invoice.paid"],
				},
				{ context },
			),
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "This feature requires a higher plan",
		});
		expect(createWebhookWithinLimit).not.toHaveBeenCalled();
	});
});
