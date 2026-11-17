import { beforeEach, describe, expect, it, vi } from "vitest";

const record = vi.hoisted(() => vi.fn());

vi.mock("@fuutu/logs", () => ({
	createAuditLogger: () => ({ record }),
}));

const { logApiKeysRevoked, logSessionCreated } = await import("../hooks/audit");

beforeEach(() => record.mockReset());

describe("logSessionCreated", () => {
	it("records impersonation starts with the impersonating admin", async () => {
		await logSessionCreated({
			userId: "user-2",
			ipAddress: "203.0.113.5",
			userAgent: "UA",
			impersonatedBy: "admin-1",
		});
		expect(record).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: "user-2",
				action: "auth.session_created",
				metadata: { impersonatedBy: "admin-1" },
			}),
		);
	});

	it("keeps an impersonation start out of the customer's org log and the support IP out of the user's feed", async () => {
		await logSessionCreated({
			userId: "user-2",
			activeOrganizationId: "org-1",
			ipAddress: "203.0.113.5",
			userAgent: "UA",
			impersonatedBy: "admin-1",
		});
		expect(record).toHaveBeenCalledWith({
			userId: "user-2",
			organizationId: null,
			action: "auth.session_created",
			ip: null,
			userAgent: null,
			metadata: { impersonatedBy: "admin-1" },
		});
	});

	it("adds no metadata for a normal sign-in", async () => {
		await logSessionCreated({
			userId: "user-3",
			activeOrganizationId: "org-1",
		});
		expect(record).toHaveBeenCalledWith({
			userId: "user-3",
			organizationId: "org-1",
			action: "auth.session_created",
			ip: null,
			userAgent: null,
		});
	});
});

describe("logApiKeysRevoked", () => {
	it("records the user, the count and the reason, no key material", async () => {
		await logApiKeysRevoked({
			userId: "user-4",
			count: 3,
			reason: "password_reset",
		});
		expect(record).toHaveBeenCalledWith({
			userId: "user-4",
			organizationId: null,
			action: "auth.api_keys_revoked",
			metadata: { count: 3, reason: "password_reset" },
		});
	});

	it("records nothing when no key was live", async () => {
		await logApiKeysRevoked({
			userId: "user-4",
			count: 0,
			reason: "mailbox_proof",
		});
		expect(record).not.toHaveBeenCalled();
	});
});
