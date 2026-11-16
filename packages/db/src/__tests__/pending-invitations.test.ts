import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pending invitations are listed (with their ids — enough to accept) only
 * for a verified email. Anyone can sign up with an invited address; until
 * they prove the mailbox, the address is only a claim.
 */

vi.mock("../../prisma/client", () => ({
	db: { invitation: { findMany: vi.fn() } },
}));

const { db } = await import("../../prisma/client");
const { listPendingInvitationsForUser } = await import(
	"../../prisma/queries/organization"
);

beforeEach(() => {
	vi.mocked(db.invitation.findMany).mockReset();
	vi.mocked(db.invitation.findMany).mockResolvedValue([
		{
			id: "inv-1",
			role: "admin",
			organization: { name: "Acme", slug: "acme" },
		},
	] as never);
});

describe("listPendingInvitationsForUser", () => {
	it("lists the pending invitations of a verified email", async () => {
		const invitations = await listPendingInvitationsForUser({
			email: "invitee@fuutu.local",
			emailVerified: true,
		});
		expect(invitations).toEqual([
			{
				id: "inv-1",
				role: "admin",
				organization: { name: "Acme", slug: "acme" },
			},
		]);
		expect(db.invitation.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					email: { equals: "invitee@fuutu.local", mode: "insensitive" },
					status: "pending",
				}),
			}),
		);
	});

	it("lists nothing for an unverified email, without querying", async () => {
		const invitations = await listPendingInvitationsForUser({
			email: "invitee@fuutu.local",
			// A caller that forgot to check (e.g. a cast) still gets nothing.
			emailVerified: false as true,
		});
		expect(invitations).toEqual([]);
		expect(db.invitation.findMany).not.toHaveBeenCalled();
	});
});
