import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/db", () => ({
	adminRevokeUserSession: vi.fn(),
}));

const audit = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("@fuutu/logs", async (importOriginal) => ({
	...(await importOriginal<typeof import("@fuutu/logs")>()),
	createAuditLogger: () => audit,
}));

const { adminRevokeUserSession } = await import("@fuutu/db");
const { endExpiredImpersonation, endImpersonation } = await import(
	"../impersonation-expiry"
);

const EXPIRED = {
	id: "sess-1",
	userId: "user-2",
	impersonatedBy: "admin-1",
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(adminRevokeUserSession).mockResolvedValue(1);
});

describe("endExpiredImpersonation", () => {
	it("deletes the impersonation session row of the user", async () => {
		await endExpiredImpersonation(EXPIRED);
		expect(adminRevokeUserSession).toHaveBeenCalledWith({
			userId: "user-2",
			sessionId: "sess-1",
		});
	});

	it("audits the expiry with the impersonating admin as actor", async () => {
		await endExpiredImpersonation(EXPIRED);
		expect(audit.record).toHaveBeenCalledOnce();
		expect(audit.record).toHaveBeenCalledWith({
			action: "admin.user.impersonate_expired",
			userId: "admin-1",
			// Support actions stay off customer org audit pages.
			organizationId: null,
			metadata: { targetUserId: "user-2" },
		});
	});

	it("audits once: a later detector finds no row and records nothing", async () => {
		vi.mocked(adminRevokeUserSession).mockResolvedValue(0);
		await endExpiredImpersonation(EXPIRED);
		expect(adminRevokeUserSession).toHaveBeenCalledOnce();
		expect(audit.record).not.toHaveBeenCalled();
	});

	it("leaves a user's own session alone", async () => {
		await endExpiredImpersonation({ ...EXPIRED, impersonatedBy: null });
		expect(adminRevokeUserSession).not.toHaveBeenCalled();
		expect(audit.record).not.toHaveBeenCalled();
	});

	it("never throws — the request counts as signed out either way", async () => {
		vi.mocked(adminRevokeUserSession).mockRejectedValue(
			new Error("database down"),
		);
		await expect(endExpiredImpersonation(EXPIRED)).resolves.toBeUndefined();
		expect(audit.record).not.toHaveBeenCalled();
	});
});

describe("endImpersonation (lost access)", () => {
	it("deletes only that session row of the user", async () => {
		await endImpersonation(EXPIRED, "lost_access");
		expect(adminRevokeUserSession).toHaveBeenCalledWith({
			userId: "user-2",
			sessionId: "sess-1",
		});
	});

	it("audits the lost access with the impersonating admin as actor", async () => {
		await endImpersonation(EXPIRED, "lost_access");
		expect(audit.record).toHaveBeenCalledOnce();
		expect(audit.record).toHaveBeenCalledWith({
			action: "admin.user.impersonate_ended_lost_access",
			userId: "admin-1",
			organizationId: null,
			metadata: { targetUserId: "user-2" },
		});
	});

	it("audits once: a second detector finds no row and records nothing", async () => {
		vi.mocked(adminRevokeUserSession).mockResolvedValue(0);
		await endImpersonation(EXPIRED, "lost_access");
		expect(audit.record).not.toHaveBeenCalled();
	});

	it("keeps the expired reason on its own audit action", async () => {
		await endImpersonation(EXPIRED, "expired");
		expect(audit.record).toHaveBeenCalledWith(
			expect.objectContaining({ action: "admin.user.impersonate_expired" }),
		);
	});
});
