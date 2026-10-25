import { describe, expect, it, vi } from "vitest";

vi.mock("../../prisma/client", () => ({
	db: {
		user: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		organization: {
			findUnique: vi.fn(),
			findMany: vi.fn(),
			update: vi.fn(),
		},
		invitation: {
			findUnique: vi.fn(),
		},
		apiKey: {
			create: vi.fn(),
			findMany: vi.fn(),
			count: vi.fn(),
			findUnique: vi.fn(),
			findFirst: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		notification: {
			create: vi.fn(),
			findUnique: vi.fn(),
			findMany: vi.fn(),
			count: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn(),
		},
		webhook: {
			create: vi.fn(),
			findMany: vi.fn(),
			count: vi.fn(),
			findFirst: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		webhookDelivery: {
			create: vi.fn(),
			update: vi.fn(),
			findMany: vi.fn(),
			count: vi.fn(),
			updateMany: vi.fn(),
		},
		purchase: {
			findFirst: vi.fn(),
		},
		$queryRaw: vi.fn(),
		$executeRaw: vi.fn(),
	},
}));

import { db } from "../../prisma/client";
import * as apiKeyQueries from "../../prisma/queries/api-key";
import * as notificationQueries from "../../prisma/queries/notification";
import * as organizationQueries from "../../prisma/queries/organization";
import * as purchaseQueries from "../../prisma/queries/purchase";
import * as userQueries from "../../prisma/queries/user";
import * as webhookQueries from "../../prisma/queries/webhook";

describe("DB query functions - smoke tests", () => {
	describe("user queries", () => {
		it("exports getUserById function", () => {
			expect(typeof userQueries.getUserById).toBe("function");
		});

		it("exports getUserByEmail function", () => {
			expect(typeof userQueries.getUserByEmail).toBe("function");
		});

		it("exports getUserByUsername function", () => {
			expect(typeof userQueries.getUserByUsername).toBe("function");
		});

		it("exports setOnboardingComplete function", () => {
			expect(typeof userQueries.setOnboardingComplete).toBe("function");
		});

		it("exports setLastActiveOrganization function", () => {
			expect(typeof userQueries.setLastActiveOrganization).toBe("function");
		});

		it("exports setPaymentsCustomerId function", () => {
			expect(typeof userQueries.setPaymentsCustomerId).toBe("function");
		});
	});

	describe("organization queries", () => {
		it("exports getOrganizationBySlug function", () => {
			expect(typeof organizationQueries.getOrganizationBySlug).toBe("function");
		});

		it("exports getOrganizationById function", () => {
			expect(typeof organizationQueries.getOrganizationById).toBe("function");
		});

		it("exports listOrganizationsForUser function", () => {
			expect(typeof organizationQueries.listOrganizationsForUser).toBe(
				"function",
			);
		});

		it("exports setOrganizationPaymentsCustomerId function", () => {
			expect(typeof organizationQueries.setOrganizationPaymentsCustomerId).toBe(
				"function",
			);
		});

		it("exports getInvitationOrganizationId function", () => {
			expect(typeof organizationQueries.getInvitationOrganizationId).toBe(
				"function",
			);
		});
	});

	describe("api-key queries", () => {
		it("exports createApiKey function", () => {
			expect(typeof apiKeyQueries.createApiKey).toBe("function");
		});

		it("exports listApiKeys function", () => {
			expect(typeof apiKeyQueries.listApiKeys).toBe("function");
		});

		it("exports countApiKeys function", () => {
			expect(typeof apiKeyQueries.countApiKeys).toBe("function");
		});

		it("exports listOrgApiKeys function", () => {
			expect(typeof apiKeyQueries.listOrgApiKeys).toBe("function");
		});

		it("exports countOrgApiKeys function", () => {
			expect(typeof apiKeyQueries.countOrgApiKeys).toBe("function");
		});

		it("exports verifyApiKey function", () => {
			expect(typeof apiKeyQueries.verifyApiKey).toBe("function");
		});

		it("exports getApiKey function", () => {
			expect(typeof apiKeyQueries.getApiKey).toBe("function");
		});

		it("exports revokeApiKey function", () => {
			expect(typeof apiKeyQueries.revokeApiKey).toBe("function");
		});

		it("exports deleteApiKey function", () => {
			expect(typeof apiKeyQueries.deleteApiKey).toBe("function");
		});
	});

	describe("notification queries", () => {
		it("exports createNotification function", () => {
			expect(typeof notificationQueries.createNotification).toBe("function");
		});

		it("exports findNotificationById function", () => {
			expect(typeof notificationQueries.findNotificationById).toBe("function");
		});

		it("exports notificationExists function", () => {
			expect(typeof notificationQueries.notificationExists).toBe("function");
		});

		it("exports listNotifications function", () => {
			expect(typeof notificationQueries.listNotifications).toBe("function");
		});

		it("exports getUnreadCount function", () => {
			expect(typeof notificationQueries.getUnreadCount).toBe("function");
		});

		it("exports countNotifications function", () => {
			expect(typeof notificationQueries.countNotifications).toBe("function");
		});

		it("exports markRead function", () => {
			expect(typeof notificationQueries.markRead).toBe("function");
		});

		it("exports markAllRead function", () => {
			expect(typeof notificationQueries.markAllRead).toBe("function");
		});
	});

	describe("purchase queries", () => {
		it("exports getPurchaseByCheckoutEventId function", () => {
			expect(typeof purchaseQueries.getPurchaseByCheckoutEventId).toBe(
				"function",
			);
		});

		it("filters via metadata ->> 'checkoutEventId' so the partial unique index is used", async () => {
			const row = { id: "pur_1", provider: "creem" };
			vi.mocked(db.$queryRaw).mockResolvedValueOnce([row] as never);

			const found = await purchaseQueries.getPurchaseByCheckoutEventId(
				"creem",
				"evt_123",
			);

			expect(found).toEqual(row);
			const [strings, ...values] = vi.mocked(db.$queryRaw).mock
				.calls[0] as unknown as [TemplateStringsArray, ...string[]];
			const sql = strings.join("");
			expect(sql).toContain("->> 'checkoutEventId'");
			expect(sql).not.toContain("#>");
			expect(values).toEqual(["creem", "evt_123"]);
		});

		it("returns null when no purchase matches the event id", async () => {
			vi.mocked(db.$queryRaw).mockResolvedValueOnce([] as never);
			expect(
				await purchaseQueries.getPurchaseByCheckoutEventId("creem", "evt_x"),
			).toBeNull();
		});
	});

	describe("webhook queries", () => {
		it("exports createWebhook function", () => {
			expect(typeof webhookQueries.createWebhook).toBe("function");
		});

		it("exports listWebhooks function", () => {
			expect(typeof webhookQueries.listWebhooks).toBe("function");
		});

		it("exports countWebhooks function", () => {
			expect(typeof webhookQueries.countWebhooks).toBe("function");
		});

		it("exports getWebhook function", () => {
			expect(typeof webhookQueries.getWebhook).toBe("function");
		});

		it("exports getWebhookForDelivery function", () => {
			expect(typeof webhookQueries.getWebhookForDelivery).toBe("function");
		});

		it("exports updateWebhook function", () => {
			expect(typeof webhookQueries.updateWebhook).toBe("function");
		});

		it("exports deleteWebhook function", () => {
			expect(typeof webhookQueries.deleteWebhook).toBe("function");
		});

		it("exports recordDelivery function", () => {
			expect(typeof webhookQueries.recordDelivery).toBe("function");
		});

		it("exports updateDeliveryStatus function", () => {
			expect(typeof webhookQueries.updateDeliveryStatus).toBe("function");
		});

		it("exports listDeliveries function", () => {
			expect(typeof webhookQueries.listDeliveries).toBe("function");
		});

		it("exports countDeliveries function", () => {
			expect(typeof webhookQueries.countDeliveries).toBe("function");
		});

		it("exports claimPendingDeliveries function", () => {
			expect(typeof webhookQueries.claimPendingDeliveries).toBe("function");
		});

		it("claimPendingDeliveries stamps attemptedAt at claim time", async () => {
			vi.mocked(db.$queryRaw).mockResolvedValueOnce([] as never);

			await webhookQueries.claimPendingDeliveries(10);

			const calls = vi.mocked(db.$queryRaw).mock.calls;
			const [strings, ...values] = calls.at(-1) as unknown as [
				TemplateStringsArray,
				...number[],
			];
			const sql = strings.join(" ");
			// Staleness for recoverStaleDeliveries is measured from the claim —
			// without this stamp a still-in-flight row could be recycled early.
			expect(sql).toContain('"attemptedAt" = NOW()');
			expect(sql).toContain("status = 'processing'");
			expect(values).toEqual([10]);
		});

		it("exports recoverStaleDeliveries function", () => {
			expect(typeof webhookQueries.recoverStaleDeliveries).toBe("function");
		});

		it("recoverStaleDeliveries consumes retry budget: increments attempt, schedules backoff, fails exhausted rows", async () => {
			vi.mocked(db.$executeRaw).mockResolvedValueOnce(2 as never);

			const result = await webhookQueries.recoverStaleDeliveries({
				timeoutMs: 60_000,
				maxRetries: 5,
				retryBaseDelayMs: 1000,
				maxRetryDelayMs: 3_600_000,
			});

			expect(result).toEqual({ count: 2 });
			const [strings, ...values] = vi.mocked(db.$executeRaw).mock
				.calls[0] as unknown as [TemplateStringsArray, ...number[]];
			const sql = strings.join(" ");
			// A crashed attempt is still an attempt — it must consume budget.
			expect(sql).toContain('"attempt" = "attempt" + 1');
			// Rows past maxRetries go terminal instead of looping forever.
			expect(sql).toContain("'failed'");
			// Recovered rows get a backoff nextRetryAt (same exponential +
			// jitter formula as retry.ts), not an immediate re-claim.
			expect(sql).toContain('POWER(2, "attempt" + 1)');
			expect(sql).toContain("INTERVAL '1 millisecond'");
			expect(values).toEqual([5, 5, 1000, 3_600_000, 5, 60_000]);
		});

		it("exports listActiveWebhooksByOrg function", () => {
			expect(typeof webhookQueries.listActiveWebhooksByOrg).toBe("function");
		});
	});
});

describe("DB query index exports", () => {
	it("re-exports all query modules", async () => {
		const queries = (await vi.importActual("../../prisma/queries")) as Record<
			string,
			unknown
		>;

		expect(queries).toHaveProperty("getUserById");
		expect(queries).toHaveProperty("getOrganizationBySlug");
		expect(queries).toHaveProperty("createApiKey");
		expect(queries).toHaveProperty("createNotification");
		expect(queries).toHaveProperty("createWebhook");
	});
});
