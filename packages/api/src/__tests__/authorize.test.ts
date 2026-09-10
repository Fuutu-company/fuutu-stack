import { checkLimit, meetsTier } from "@fuutu/payments/plan-resolver";
import { ORPCError } from "@orpc/server";
import { describe, expect, it, vi } from "vitest";
import type { Context } from "../context";

// ─── Unit tests for plan-resolver helpers ────────────────────────────────────

describe("meetsTier", () => {
	it("free meets free", () => {
		expect(meetsTier("free", "free")).toBe(true);
	});
	it("free does not meet pro", () => {
		expect(meetsTier("free", "pro")).toBe(false);
	});
	it("pro meets free", () => {
		expect(meetsTier("pro", "free")).toBe(true);
	});
	it("pro meets pro", () => {
		expect(meetsTier("pro", "pro")).toBe(true);
	});
	it("pro does not meet enterprise", () => {
		expect(meetsTier("pro", "enterprise")).toBe(false);
	});
	it("enterprise meets all", () => {
		expect(meetsTier("enterprise", "free")).toBe(true);
		expect(meetsTier("enterprise", "pro")).toBe(true);
		expect(meetsTier("enterprise", "enterprise")).toBe(true);
	});
});

describe("checkLimit", () => {
	it("allows when count < numeric limit", () => {
		expect(checkLimit(5, 3).ok).toBe(true);
	});
	it("blocks when count >= numeric limit", () => {
		const result = checkLimit(5, 5);
		expect(result.ok).toBe(false);
	});
	it("blocks when limit is false (feature not available)", () => {
		const result = checkLimit(false, 0);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("feature-not-available");
		}
	});
	it("allows when limit is unlimited", () => {
		expect(checkLimit("unlimited", 9999).ok).toBe(true);
	});
	it("blocks when count exceeds limit", () => {
		const result = checkLimit(2, 10);
		expect(result.ok).toBe(false);
		if (!result.ok && result.reason === "limit-exceeded") {
			expect(result.limit).toBe(2);
			expect(result.current).toBe(10);
		}
	});
});

// ─── Integration tests for runAuthorize ──────────────────────────────────────

vi.mock("@fuutu/auth", () => ({
	auth: {
		api: {
			getFullOrganization: vi.fn(),
		},
	},
}));

vi.mock("@fuutu/db", () => ({
	getActiveSubscriptionForUser: vi.fn().mockResolvedValue(null),
	getActiveSubscriptionForOrganization: vi.fn().mockResolvedValue(null),
}));

import { PERMISSIONS } from "@fuutu/rbac";
import { runAuthorize } from "../orpc/middleware/authorize";

function makeContext(overrides: Record<string, unknown> = {}) {
	return {
		session: {
			user: {
				id: "user-1",
				role: "user",
				email: "test@test.com",
				name: "Test",
				banned: false,
			},
		},
		headers: new Headers(),
		...overrides,
	};
}

describe("runAuthorize", () => {
	it("throws UNAUTHORIZED when no session", async () => {
		await expect(
			runAuthorize(
				{},
				{ session: null, headers: new Headers() } as unknown as Context,
				{},
			),
		).rejects.toThrow(ORPCError);
		try {
			await runAuthorize(
				{},
				{ session: null, headers: new Headers() } as unknown as Context,
				{},
			);
		} catch (e) {
			expect((e as { code: string }).code).toBe("UNAUTHORIZED");
		}
	});

	it("passes with auth only (no options)", async () => {
		const ctx = await runAuthorize({}, makeContext() as unknown as Context, {});
		expect(ctx.user.id).toBe("user-1");
		expect(ctx.systemRole).toBe("user");
	});

	it("throws FORBIDDEN when system permission missing", async () => {
		await expect(
			runAuthorize(
				{ systemPermission: PERMISSIONS.VIEW_ADMIN },
				makeContext() as unknown as Context,
				{},
			),
		).rejects.toThrow(ORPCError);
		try {
			await runAuthorize(
				{ systemPermission: PERMISSIONS.VIEW_ADMIN },
				makeContext() as unknown as Context,
				{},
			);
		} catch (e) {
			expect((e as { code: string }).code).toBe("FORBIDDEN");
		}
	});

	it("passes when system permission present", async () => {
		const ctx = await runAuthorize(
			{ systemPermission: PERMISSIONS.API_KEY.CREATE },
			makeContext() as unknown as Context,
			{},
		);
		expect(ctx.user.id).toBe("user-1");
	});

	it("throws BAD_REQUEST when org required but no orgId in input", async () => {
		await expect(
			runAuthorize(
				{ org: { permission: PERMISSIONS.ORGANIZATION.DELETE } },
				makeContext() as unknown as Context,
				{},
			),
		).rejects.toThrow(ORPCError);
		try {
			await runAuthorize(
				{ org: { permission: PERMISSIONS.ORGANIZATION.DELETE } },
				makeContext() as unknown as Context,
				{},
			);
		} catch (e) {
			expect((e as { code: string }).code).toBe("BAD_REQUEST");
		}
	});

	it("skips org check when optional and no orgId", async () => {
		const ctx = await runAuthorize(
			{ org: { permission: PERMISSIONS.API_KEY.CREATE, optional: true } },
			makeContext() as unknown as Context,
			{},
		);
		expect(ctx.org).toBeUndefined();
	});

	it("org-scoped: passes with org permission even when system permission would fail", async () => {
		// User has system role "user" — does NOT have VIEW_ADMIN
		// But if org-scoped, the org permission is the authority, not system
		const { auth } = await import("@fuutu/auth");
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue({
			id: "org-1",
			members: [{ userId: "user-1", role: "member", id: "m-1" }],
		} as never);

		// systemPermission would fail for "user" (no VIEW_ADMIN),
		// but orgId is present → org-scoped → system check is skipped
		const ctx = await runAuthorize(
			{
				systemPermission: PERMISSIONS.VIEW_ADMIN,
				org: { permission: PERMISSIONS.API_KEY.CREATE, optional: true },
			},
			makeContext() as unknown as Context,
			{ organizationId: "org-1" },
		);
		expect(ctx.org?.id).toBe("org-1");
		expect(ctx.orgRole).toBe("member");
	});

	it("user-scoped: fails when system permission missing and no orgId", async () => {
		// No orgId → user-scoped → system check runs
		// "user" does not have VIEW_ADMIN → FORBIDDEN
		await expect(
			runAuthorize(
				{
					systemPermission: PERMISSIONS.VIEW_ADMIN,
					org: { permission: PERMISSIONS.API_KEY.CREATE, optional: true },
				},
				makeContext() as unknown as Context,
				{},
			),
		).rejects.toThrow(ORPCError);
	});
});
