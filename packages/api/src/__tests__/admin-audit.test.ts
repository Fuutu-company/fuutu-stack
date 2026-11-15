import { beforeEach, describe, expect, it, vi } from "vitest";

const record = vi.hoisted(() => vi.fn());

vi.mock("@fuutu/logs", async (importOriginal) => ({
	...(await importOriginal<typeof import("@fuutu/logs")>()),
	createAuditLogger: () => ({ record }),
}));

const { recordAdminAction } = await import("../modules/admin/audit");

const context = {
	user: { id: "admin-1", email: "admin@fuutu.local" },
	headers: new Headers({
		"user-agent": "Mozilla/5.0",
		"x-forwarded-for": "198.51.100.7",
	}),
};

beforeEach(() => record.mockReset());

describe("recordAdminAction", () => {
	it("records the actor as userId and never an organization", async () => {
		await recordAdminAction(context, {
			action: "admin.user.ban",
			targetUserId: "user-2",
			reason: "Chargeback fraud",
		});
		expect(record).toHaveBeenCalledWith({
			action: "admin.user.ban",
			userId: "admin-1",
			organizationId: null,
			// Forwarding headers are untrusted without TRUST_PROXY_HEADERS.
			ip: null,
			userAgent: "Mozilla/5.0",
			metadata: { targetUserId: "user-2", reason: "Chargeback fraud" },
		});
	});

	it("stores changed field names, not values (no emails in the audit log)", async () => {
		await recordAdminAction(context, {
			action: "admin.user.update",
			targetUserId: "user-2",
			changedFields: ["email", "emailVerified"],
			reason: "Customer asked by ticket",
		});
		const event = record.mock.calls[0]?.[0];
		expect(event.metadata).toEqual({
			targetUserId: "user-2",
			reason: "Customer asked by ticket",
			changedFields: ["email", "emailVerified"],
		});
		expect(JSON.stringify(event)).not.toContain("@");
	});

	it("records an org target in metadata, keeping organizationId null", async () => {
		await recordAdminAction(context, {
			action: "admin.org.rename",
			targetOrganizationId: "org-1",
		});
		expect(record).toHaveBeenCalledWith(
			expect.objectContaining({
				organizationId: null,
				metadata: { targetOrganizationId: "org-1" },
			}),
		);
	});

	it("lets the caller name a different actor (impersonation stop)", async () => {
		await recordAdminAction(
			{ user: { id: "user-2" }, headers: new Headers() },
			{
				action: "admin.user.impersonate_stop",
				actorUserId: "admin-1",
				targetUserId: "user-2",
			},
		);
		expect(record).toHaveBeenCalledWith({
			action: "admin.user.impersonate_stop",
			userId: "admin-1",
			organizationId: null,
			ip: null,
			userAgent: null,
			metadata: { targetUserId: "user-2" },
		});
	});
});
