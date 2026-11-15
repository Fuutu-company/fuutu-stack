import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Support (system admin) organization actions — the DB writes plus the
 * side effects Better Auth's organizationHooks run for the same change.
 */

vi.mock("@fuutu/db", () => ({
	getOrganizationMemberForAdmin: vi.fn(),
	countOrganizationOwners: vi.fn(),
	adminRemoveOrganizationMember: vi.fn(),
	adminSetOrganizationMemberRole: vi.fn(),
	adminTransferOrganizationOwnership: vi.fn(),
	adminDeleteOrganization: vi.fn(),
	adminGetOrganizationInvitation: vi.fn(),
	adminExtendOrganizationInvitation: vi.fn(),
}));

vi.mock("../hooks/member-api-keys", () => ({
	revokeApiKeysOfRemovedMember: vi.fn(),
}));

vi.mock("../hooks/payments-sync", () => ({
	syncSeatsForOrganization: vi.fn(),
	cancelActiveSubscriptionsForOrganization: vi.fn(),
}));

vi.mock("../hooks/seat-limit", () => ({
	assertInviteSeatAvailable: vi.fn(),
}));

vi.mock("../lib/invitation-email", () => ({
	sendOrganizationInvitationEmail: vi.fn(),
}));

const db = await import("@fuutu/db");
const { revokeApiKeysOfRemovedMember } = await import(
	"../hooks/member-api-keys"
);
const { syncSeatsForOrganization, cancelActiveSubscriptionsForOrganization } =
	await import("../hooks/payments-sync");
const { assertInviteSeatAvailable } = await import("../hooks/seat-limit");
const { sendOrganizationInvitationEmail } = await import(
	"../lib/invitation-email"
);
const { config } = await import("@fuutu/config");
const support = await import("../admin-support");

const NOW = new Date("2026-06-01T12:00:00Z");
const HOUR = 60 * 60 * 1000;

const MEMBER = {
	id: "mem-2",
	organizationId: "org-1",
	userId: "user-2",
	role: "member",
};
const OWNER = { ...MEMBER, id: "mem-1", userId: "user-1", role: "owner" };

const order: string[] = [];

beforeEach(() => {
	vi.clearAllMocks();
	order.length = 0;
	vi.mocked(revokeApiKeysOfRemovedMember).mockImplementation(async () => {
		order.push("revokeKeys");
	});
	vi.mocked(db.adminRemoveOrganizationMember).mockImplementation(async () => {
		order.push("delete");
		return { status: "removed", member: MEMBER };
	});
	vi.mocked(syncSeatsForOrganization).mockImplementation(async () => {
		order.push("syncSeats");
	});
	vi.mocked(cancelActiveSubscriptionsForOrganization).mockImplementation(
		async () => {
			order.push("cancelSubscriptions");
		},
	);
	vi.mocked(db.adminDeleteOrganization).mockImplementation(async () => {
		order.push("deleteOrg");
		return 1;
	});
	vi.mocked(sendOrganizationInvitationEmail).mockResolvedValue(true);
	vi.mocked(db.adminExtendOrganizationInvitation).mockResolvedValue(1);
});

// ─── Remove member ──────────────────────────────────────────────────────────

describe("supportRemoveMember", () => {
	it("revokes the member's org API keys, removes them, then syncs seats", async () => {
		vi.mocked(db.getOrganizationMemberForAdmin).mockResolvedValue(MEMBER);
		await expect(
			support.supportRemoveMember({
				organizationId: "org-1",
				memberId: "mem-2",
			}),
		).resolves.toEqual({ status: "removed", member: MEMBER });
		expect(db.getOrganizationMemberForAdmin).toHaveBeenCalledWith(
			"org-1",
			"mem-2",
		);
		expect(revokeApiKeysOfRemovedMember).toHaveBeenCalledWith(MEMBER);
		expect(db.adminRemoveOrganizationMember).toHaveBeenCalledWith({
			organizationId: "org-1",
			memberId: "mem-2",
		});
		expect(syncSeatsForOrganization).toHaveBeenCalledWith("org-1");
		expect(order).toEqual(["revokeKeys", "delete", "syncSeats"]);
	});

	it("touches nothing for a member of another organization", async () => {
		vi.mocked(db.getOrganizationMemberForAdmin).mockResolvedValue(null);
		await expect(
			support.supportRemoveMember({
				organizationId: "org-1",
				memberId: "mem-x",
			}),
		).resolves.toEqual({ status: "not_found" });
		expect(revokeApiKeysOfRemovedMember).not.toHaveBeenCalled();
		expect(db.adminRemoveOrganizationMember).not.toHaveBeenCalled();
		expect(syncSeatsForOrganization).not.toHaveBeenCalled();
	});

	it("never removes the last owner — and keeps their API keys", async () => {
		vi.mocked(db.getOrganizationMemberForAdmin).mockResolvedValue(OWNER);
		vi.mocked(db.countOrganizationOwners).mockResolvedValue(1);
		await expect(
			support.supportRemoveMember({
				organizationId: "org-1",
				memberId: "mem-1",
			}),
		).resolves.toEqual({ status: "last_owner" });
		expect(db.countOrganizationOwners).toHaveBeenCalledWith("org-1");
		expect(revokeApiKeysOfRemovedMember).not.toHaveBeenCalled();
		expect(db.adminRemoveOrganizationMember).not.toHaveBeenCalled();
	});

	it("removes an owner while another owner remains", async () => {
		vi.mocked(db.getOrganizationMemberForAdmin).mockResolvedValue(OWNER);
		vi.mocked(db.countOrganizationOwners).mockResolvedValue(2);
		vi.mocked(db.adminRemoveOrganizationMember).mockResolvedValueOnce({
			status: "removed",
			member: OWNER,
		});
		await expect(
			support.supportRemoveMember({
				organizationId: "org-1",
				memberId: "mem-1",
			}),
		).resolves.toEqual({ status: "removed", member: OWNER });
	});

	it("skips the seat sync when the transactional re-check refuses", async () => {
		vi.mocked(db.getOrganizationMemberForAdmin).mockResolvedValue(OWNER);
		vi.mocked(db.countOrganizationOwners).mockResolvedValue(2);
		vi.mocked(db.adminRemoveOrganizationMember).mockResolvedValueOnce({
			status: "last_owner",
		});
		await expect(
			support.supportRemoveMember({
				organizationId: "org-1",
				memberId: "mem-1",
			}),
		).resolves.toEqual({ status: "last_owner" });
		expect(syncSeatsForOrganization).not.toHaveBeenCalled();
	});

	it("aborts the removal when revoking the API keys fails (fail closed)", async () => {
		vi.mocked(db.getOrganizationMemberForAdmin).mockResolvedValue(MEMBER);
		vi.mocked(revokeApiKeysOfRemovedMember).mockRejectedValueOnce(
			new Error("db down"),
		);
		await expect(
			support.supportRemoveMember({
				organizationId: "org-1",
				memberId: "mem-2",
			}),
		).rejects.toThrow("db down");
		expect(db.adminRemoveOrganizationMember).not.toHaveBeenCalled();
	});
});

// ─── Role / ownership ───────────────────────────────────────────────────────

describe("supportSetMemberRole / supportTransferOwnership", () => {
	it("delegates the role change to the owner-safe query", async () => {
		vi.mocked(db.adminSetOrganizationMemberRole).mockResolvedValue({
			status: "last_owner",
		});
		await expect(
			support.supportSetMemberRole({
				organizationId: "org-1",
				memberId: "mem-1",
				role: "admin",
			}),
		).resolves.toEqual({ status: "last_owner" });
		expect(db.adminSetOrganizationMemberRole).toHaveBeenCalledWith({
			organizationId: "org-1",
			memberId: "mem-1",
			role: "admin",
		});
	});

	it("delegates the transfer to the single-transaction query", async () => {
		const result = {
			status: "transferred" as const,
			member: { ...MEMBER, role: "owner" },
			previousRole: "member",
			demotedOwners: 1,
		};
		vi.mocked(db.adminTransferOrganizationOwnership).mockResolvedValue(result);
		await expect(
			support.supportTransferOwnership({
				organizationId: "org-1",
				memberId: "mem-2",
			}),
		).resolves.toEqual(result);
		expect(db.adminTransferOrganizationOwnership).toHaveBeenCalledWith({
			organizationId: "org-1",
			memberId: "mem-2",
		});
	});
});

// ─── Delete organization ────────────────────────────────────────────────────

describe("supportDeleteOrganization", () => {
	it("cancels the organization's subscriptions before deleting it", async () => {
		await expect(support.supportDeleteOrganization("org-1")).resolves.toBe(
			true,
		);
		expect(cancelActiveSubscriptionsForOrganization).toHaveBeenCalledWith(
			"org-1",
		);
		expect(db.adminDeleteOrganization).toHaveBeenCalledWith("org-1");
		expect(order).toEqual(["cancelSubscriptions", "deleteOrg"]);
	});

	it("reports false when the organization was already gone", async () => {
		vi.mocked(db.adminDeleteOrganization).mockResolvedValueOnce(0);
		await expect(support.supportDeleteOrganization("org-1")).resolves.toBe(
			false,
		);
	});
});

// ─── Resend invitation ──────────────────────────────────────────────────────

const INVITATION = {
	id: "inv-1",
	organizationId: "org-1",
	email: "new@acme.test",
	role: "member",
	status: "pending",
	expiresAt: new Date(NOW.getTime() + HOUR),
	createdAt: new Date(NOW.getTime() - HOUR),
	inviter: { id: "user-1", name: "Grace", locale: "de" },
	organization: { name: "Acme" },
};

const resend = (invitationId = "inv-1") =>
	support.supportResendInvitation({
		organizationId: "org-1",
		invitationId,
		now: NOW,
	});

describe("supportResendInvitation", () => {
	it("restarts the 48 h validity and resends the email in the original inviter's name", async () => {
		vi.mocked(db.adminGetOrganizationInvitation).mockResolvedValue(INVITATION);
		const expiresAt = new Date(NOW.getTime() + 48 * HOUR);
		await expect(resend()).resolves.toEqual({
			status: "resent",
			emailSent: true,
			invitation: {
				id: "inv-1",
				email: "new@acme.test",
				role: "member",
				status: "pending",
				expiresAt,
			},
		});
		expect(db.adminGetOrganizationInvitation).toHaveBeenCalledWith(
			"org-1",
			"inv-1",
		);
		expect(db.adminExtendOrganizationInvitation).toHaveBeenCalledWith({
			organizationId: "org-1",
			invitationId: "inv-1",
			expiresAt,
		});
		expect(sendOrganizationInvitationEmail).toHaveBeenCalledWith({
			email: "new@acme.test",
			invitationId: "inv-1",
			organizationName: "Acme",
			inviterName: "Grace",
			locale: "de",
		});
		// An unexpired invitation already holds its seat.
		expect(assertInviteSeatAvailable).not.toHaveBeenCalled();
	});

	it("falls back to the app name when the inviter has no name", async () => {
		vi.mocked(db.adminGetOrganizationInvitation).mockResolvedValue({
			...INVITATION,
			inviter: { id: "user-1", name: "", locale: null },
		});
		await resend();
		expect(sendOrganizationInvitationEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				inviterName: config.app.name,
				locale: undefined,
			}),
		);
	});

	it("reports the email delivery result", async () => {
		vi.mocked(db.adminGetOrganizationInvitation).mockResolvedValue(INVITATION);
		vi.mocked(sendOrganizationInvitationEmail).mockResolvedValueOnce(false);
		await expect(resend()).resolves.toMatchObject({
			status: "resent",
			emailSent: false,
		});
	});

	it("checks the seat cap before reviving an expired invitation", async () => {
		vi.mocked(db.adminGetOrganizationInvitation).mockResolvedValue({
			...INVITATION,
			expiresAt: new Date(NOW.getTime() - HOUR),
		});
		vi.mocked(assertInviteSeatAvailable).mockRejectedValueOnce(
			new APIError("PAYMENT_REQUIRED", { message: "seat limit" }),
		);
		await expect(resend()).rejects.toMatchObject({ statusCode: 402 });
		expect(assertInviteSeatAvailable).toHaveBeenCalledWith("org-1");
		expect(db.adminExtendOrganizationInvitation).not.toHaveBeenCalled();
		expect(sendOrganizationInvitationEmail).not.toHaveBeenCalled();
	});

	it("reports not_found for an invitation of another organization", async () => {
		vi.mocked(db.adminGetOrganizationInvitation).mockResolvedValue(null);
		await expect(resend("inv-x")).resolves.toEqual({ status: "not_found" });
		expect(sendOrganizationInvitationEmail).not.toHaveBeenCalled();
	});

	it.each(["accepted", "rejected", "canceled"])(
		"refuses a %s invitation",
		async (status) => {
			vi.mocked(db.adminGetOrganizationInvitation).mockResolvedValue({
				...INVITATION,
				status,
			});
			await expect(resend()).resolves.toEqual({ status: "not_pending" });
			expect(db.adminExtendOrganizationInvitation).not.toHaveBeenCalled();
			expect(sendOrganizationInvitationEmail).not.toHaveBeenCalled();
		},
	);

	it("sends nothing when the invitation stopped being pending meanwhile", async () => {
		vi.mocked(db.adminGetOrganizationInvitation).mockResolvedValue(INVITATION);
		vi.mocked(db.adminExtendOrganizationInvitation).mockResolvedValueOnce(0);
		await expect(resend()).resolves.toEqual({ status: "not_pending" });
		expect(sendOrganizationInvitationEmail).not.toHaveBeenCalled();
	});
});
