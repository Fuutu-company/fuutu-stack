import { beforeEach, describe, expect, it, vi } from "vitest";

const record = vi.hoisted(() => vi.fn());

vi.mock("@fuutu/logs", () => ({
	createAuditLogger: () => ({ record }),
}));

const { logSessionCreated } = await import("../hooks/audit");

beforeEach(() => record.mockReset());

describe("logSessionCreated", () => {
	it("records impersonation starts with the impersonating admin", async () => {
		await logSessionCreated({
			userId: "user-2",
			ipAddress: "203.0.113.5",
			userAgent: "UA",
			impersonatedBy: "admin-1",
		});
		expect(record).toHaveBeenCalledWith({
			userId: "user-2",
			organizationId: null,
			action: "auth.session_created",
			ip: "203.0.113.5",
			userAgent: "UA",
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
