import type { Entitlement } from "@fuutu/payments";
import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";

// A registered entitlement resolver must drive every oRPC plan/limit gate,
// not only direct getOrgEntitlement callers. The DB says "pro" for both the
// org and the user; the resolver says otherwise.
vi.mock("@fuutu/db", () => ({
	createWebhookWithinLimit: vi.fn(),
	countWebhooks: vi.fn().mockResolvedValue(0),
	createApiKeyWithinLimit: vi.fn(),
	countApiKeys: vi.fn().mockResolvedValue(0),
	countOrgApiKeys: vi.fn().mockResolvedValue(0),
	getActiveSubscriptionForOrganization: vi.fn(),
	getActiveSubscriptionForUser: vi.fn(),
}));

vi.mock("@fuutu/payments/config.server", () => ({
	getPlanIdForProductId: vi.fn().mockReturnValue("pro"),
}));

vi.mock("@fuutu/auth", () => ({
	auth: { api: { getFullOrganization: vi.fn() } },
}));

vi.mock("@fuutu/ai", () => ({ resolveAIProvider: vi.fn() }));

const {
	createWebhookWithinLimit,
	createApiKeyWithinLimit,
	countOrgApiKeys,
	getActiveSubscriptionForOrganization,
	getActiveSubscriptionForUser,
} = await import("@fuutu/db");
const { auth } = await import("@fuutu/auth");
const { registerEntitlementResolver } = await import("@fuutu/payments");
const { webhooksRouter } = await import("../modules/webhooks/router");
const { apiKeysRouter } = await import("../modules/api-keys/router");

const context = makeSession<Context>(makeUser());

function freeEntitlement(
	scope: Entitlement["scope"],
	ownerId: string,
	apiKeys: Entitlement["limits"]["apiKeys"] = 2,
): Entitlement {
	return {
		scope,
		ownerId,
		planId: "free",
		tier: "free",
		features: [],
		limits: {
			organizations: 1,
			membersPerOrg: 5,
			apiKeys,
			webhooks: false,
			storageMb: 500,
			auditLogDays: false,
		},
		seatsTotal: 5,
	};
}

const createWebhook = () =>
	call(
		webhooksRouter.create,
		{
			organizationId: "org-1",
			url: "https://example.com/webhook",
			events: ["invoice.paid"],
		},
		{ context },
	);

describe("oRPC gates honour the registered entitlement resolver", () => {
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
		vi.mocked(getActiveSubscriptionForUser).mockResolvedValue({
			productId: "price_pro",
			status: "ACTIVE",
		} as never);
		vi.mocked(createWebhookWithinLimit).mockResolvedValue({
			id: "wh-1",
		} as never);
		vi.mocked(createApiKeyWithinLimit).mockResolvedValue({
			id: "key-1",
		} as never);
	});

	afterEach(() => {
		registerEntitlementResolver(null);
	});

	it("without a resolver a pro org creates webhooks under the pro cap", async () => {
		await createWebhook();
		expect(createWebhookWithinLimit).toHaveBeenCalledWith(
			expect.objectContaining({ max: 10 }),
		);
	});

	it("an org resolver that downgrades to free blocks webhooks.create", async () => {
		registerEntitlementResolver({
			org: async (id) => freeEntitlement("organization", id),
		});
		await expect(createWebhook()).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "This feature requires a higher plan",
		});
		expect(createWebhookWithinLimit).not.toHaveBeenCalled();
	});

	it("an org resolver's api-key limit applies to the pre-flight gate", async () => {
		registerEntitlementResolver({
			org: async (id) => freeEntitlement("organization", id),
		});
		vi.mocked(countOrgApiKeys).mockResolvedValue(2);
		await expect(
			call(
				apiKeysRouter.create,
				{ name: "ci", organizationId: "org-1" },
				{ context },
			),
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "Limit exceeded (2/2)",
		});
		expect(createApiKeyWithinLimit).not.toHaveBeenCalled();
	});

	it("an org resolver's api-key limit applies to the race-safe create", async () => {
		registerEntitlementResolver({
			org: async (id) => freeEntitlement("organization", id, 3),
		});
		await call(
			apiKeysRouter.create,
			{ name: "ci", organizationId: "org-1" },
			{ context },
		);
		expect(createApiKeyWithinLimit).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: "org-1", max: 3 }),
		);
	});

	it("a user resolver's api-key limit applies to personal keys", async () => {
		registerEntitlementResolver({
			user: async (id) => freeEntitlement("user", id, 1),
		});
		await call(apiKeysRouter.create, { name: "personal" }, { context });
		expect(createApiKeyWithinLimit).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: null, max: 1 }),
		);
	});
});
