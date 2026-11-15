import { beforeEach, describe, expect, it, vi } from "vitest";

const record = vi.hoisted(() => vi.fn());
const recordStrict = vi.hoisted(() => vi.fn());

vi.mock("@fuutu/logs", async (importOriginal) => ({
	...(await importOriginal<typeof import("@fuutu/logs")>()),
	createAuditLogger: () => ({ record, recordStrict }),
}));

const { recordAdminAction, recordAdminActionStrict, runAuditedAdminAction } =
	await import("../modules/admin/audit");

const context = {
	user: { id: "admin-1", email: "admin@fuutu.local" },
	headers: new Headers({
		"user-agent": "Mozilla/5.0",
		"x-forwarded-for": "198.51.100.7",
	}),
};

beforeEach(() => {
	record.mockReset();
	recordStrict.mockReset();
});

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

/**
 * No impersonation or irreversible support action without a persisted row:
 * these rows go through `recordStrict`, which rejects when the sink fails.
 */
describe("recordAdminActionStrict", () => {
	it("writes the same row strictly", async () => {
		await recordAdminActionStrict(context, {
			action: "admin.user.impersonate_start",
			targetUserId: "user-2",
			reason: "Ticket 42",
		});
		expect(recordStrict).toHaveBeenCalledWith({
			action: "admin.user.impersonate_start",
			userId: "admin-1",
			organizationId: null,
			ip: null,
			userAgent: "Mozilla/5.0",
			metadata: { targetUserId: "user-2", reason: "Ticket 42" },
		});
		expect(record).not.toHaveBeenCalled();
	});

	it("rejects when the row cannot be persisted", async () => {
		recordStrict.mockRejectedValueOnce(new Error("audit sink down"));
		await expect(
			recordAdminActionStrict(context, { action: "admin.user.ban" }),
		).rejects.toThrow("audit sink down");
	});
});

describe("runAuditedAdminAction", () => {
	it("writes the before-row strictly and never runs without it", async () => {
		recordStrict.mockRejectedValueOnce(new Error("audit sink down"));
		const run = vi.fn();
		await expect(
			runAuditedAdminAction(
				context,
				{ action: "admin.user.delete", targetUserId: "user-2" },
				run,
			),
		).rejects.toThrow("audit sink down");
		expect(run).not.toHaveBeenCalled();
		expect(record).not.toHaveBeenCalled();
	});

	it("writes the before-row strictly, then runs", async () => {
		const run = vi.fn().mockResolvedValue("done");
		await expect(
			runAuditedAdminAction(context, { action: "admin.org.delete" }, run),
		).resolves.toBe("done");
		expect(recordStrict).toHaveBeenCalledWith(
			expect.objectContaining({ action: "admin.org.delete" }),
		);
		expect(recordStrict.mock.invocationCallOrder[0]).toBeLessThan(
			run.mock.invocationCallOrder[0] ?? 0,
		);
	});

	it("keeps the _failed row lenient so the action's own error surfaces", async () => {
		await expect(
			runAuditedAdminAction(context, { action: "admin.user.ban" }, () =>
				Promise.reject(new Error("ban failed")),
			),
		).rejects.toThrow("ban failed");
		expect(record).toHaveBeenCalledWith(
			expect.objectContaining({ action: "admin.user.ban_failed" }),
		);
		expect(recordStrict).toHaveBeenCalledOnce();
	});
});
