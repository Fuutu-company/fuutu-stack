import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../prisma/client", () => {
	const db = {
		$transaction: vi.fn(),
		organization: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			count: vi.fn(),
			update: vi.fn(),
			deleteMany: vi.fn(),
		},
		member: {
			findFirst: vi.fn(),
			count: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn(),
			deleteMany: vi.fn(),
		},
		invitation: { findFirst: vi.fn(), updateMany: vi.fn() },
	};
	return { db };
});

import { db } from "../../prisma/client";
import {
	adminCancelOrganizationInvitation,
	adminCountOrganizations,
	adminDeleteOrganization,
	adminExtendOrganizationInvitation,
	adminGetOrganizationDetail,
	adminGetOrganizationInvitation,
	adminListOrganizations,
	adminRemoveOrganizationMember,
	adminRenameOrganization,
	adminSetOrganizationMemberRole,
	adminTransferOrganizationOwnership,
	countOrganizationOwners,
	getOrganizationMemberForAdmin,
} from "../../prisma/queries/admin-organization";

const NOW = new Date("2026-06-01T12:00:00Z");

const OWNER_ROLE = {
	OR: [
		{ role: { equals: "owner" } },
		{ role: { startsWith: "owner," } },
		{ role: { endsWith: ",owner" } },
		{ role: { contains: ",owner," } },
	],
};

/** Interactive transactions run against the same mocked client. */
function runTransactionsInline() {
	vi.mocked(db.$transaction).mockImplementation(((
		fn: (tx: typeof db) => unknown,
	) => Promise.resolve(fn(db))) as never);
}

beforeEach(() => {
	vi.clearAllMocks();
	runTransactionsInline();
});

// ─── List ───────────────────────────────────────────────────────────────────

describe("adminListOrganizations", () => {
	it("defaults to newest first, page 1 of 25, with a stable tiebreak", async () => {
		vi.mocked(db.organization.findMany).mockResolvedValueOnce([] as never);
		await adminListOrganizations({ now: NOW });
		expect(db.organization.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { AND: [] },
				orderBy: [{ createdAt: "desc" }, { id: "asc" }],
				take: 25,
				skip: 0,
			}),
		);
	});

	it("searches name and slug case-insensitively and ids exactly", async () => {
		vi.mocked(db.organization.findMany).mockResolvedValueOnce([] as never);
		await adminListOrganizations({ q: "  Acme ", now: NOW });
		expect(db.organization.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					AND: [
						{
							OR: [
								{ name: { contains: "Acme", mode: "insensitive" } },
								{ slug: { contains: "Acme", mode: "insensitive" } },
								{ id: "Acme" },
							],
						},
					],
				},
			}),
		);
	});

	it("sorts by member count and paginates", async () => {
		vi.mocked(db.organization.findMany).mockResolvedValueOnce([] as never);
		await adminListOrganizations({
			sort: "members",
			dir: "asc",
			page: 3,
			pageSize: 10,
			now: NOW,
		});
		expect(db.organization.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				orderBy: [{ members: { _count: "asc" } }, { id: "asc" }],
				take: 10,
				skip: 20,
			}),
		);
	});

	it("counts members and unexpired pending invitations and picks the access-gating subscription", async () => {
		vi.mocked(db.organization.findMany).mockResolvedValueOnce([] as never);
		await adminListOrganizations({ now: NOW });
		const args = vi.mocked(db.organization.findMany).mock.calls[0]?.[0];
		expect(args?.select?._count).toEqual({
			select: {
				members: true,
				invitations: {
					where: { status: "pending", expiresAt: { gt: NOW } },
				},
			},
		});
		expect(args?.select?.purchases).toMatchObject({
			where: {
				type: "SUBSCRIPTION",
				OR: [
					{ status: { in: ["ACTIVE", "TRIALING"] } },
					{ status: "SCHEDULED_CANCEL", currentPeriodEnd: { gt: NOW } },
				],
			},
			orderBy: [{ createdAt: "desc" }, { id: "asc" }],
			take: 1,
		});
	});

	it("never selects metadata or the payments customer id", async () => {
		vi.mocked(db.organization.findMany).mockResolvedValueOnce([] as never);
		await adminListOrganizations({ now: NOW });
		const select = vi.mocked(db.organization.findMany).mock.calls[0]?.[0]
			?.select;
		expect(select).not.toHaveProperty("metadata");
		expect(select).not.toHaveProperty("paymentsCustomerId");
	});

	it("flattens counts and the subscription into each row", async () => {
		vi.mocked(db.organization.findMany).mockResolvedValueOnce([
			{
				id: "org-1",
				name: "Acme",
				slug: "acme",
				logo: null,
				createdAt: NOW,
				_count: { members: 4, invitations: 2 },
				purchases: [
					{
						id: "pur-1",
						status: "ACTIVE",
						priceId: "price_pro",
						productId: "prod_pro",
						quantity: 4,
						currentPeriodEnd: NOW,
					},
				],
			},
			{
				id: "org-2",
				name: "Free Co",
				slug: "free-co",
				logo: null,
				createdAt: NOW,
				_count: { members: 1, invitations: 0 },
				purchases: [],
			},
		] as never);
		const rows = await adminListOrganizations({ now: NOW });
		expect(rows).toEqual([
			{
				id: "org-1",
				name: "Acme",
				slug: "acme",
				logo: null,
				createdAt: NOW,
				memberCount: 4,
				pendingInvitationCount: 2,
				activeSubscription: {
					id: "pur-1",
					status: "ACTIVE",
					priceId: "price_pro",
					productId: "prod_pro",
					quantity: 4,
					currentPeriodEnd: NOW,
				},
			},
			{
				id: "org-2",
				name: "Free Co",
				slug: "free-co",
				logo: null,
				createdAt: NOW,
				memberCount: 1,
				pendingInvitationCount: 0,
				activeSubscription: null,
			},
		]);
	});
});

describe("adminCountOrganizations", () => {
	it("counts with the same search as the list", async () => {
		vi.mocked(db.organization.count).mockResolvedValueOnce(7);
		await expect(adminCountOrganizations({ q: "acme" })).resolves.toBe(7);
		expect(db.organization.count).toHaveBeenCalledWith({
			where: {
				AND: [
					{
						OR: [
							{ name: { contains: "acme", mode: "insensitive" } },
							{ slug: { contains: "acme", mode: "insensitive" } },
							{ id: "acme" },
						],
					},
				],
			},
		});
	});
});

// ─── Detail ─────────────────────────────────────────────────────────────────

describe("adminGetOrganizationDetail", () => {
	it("returns null for an unknown organization", async () => {
		vi.mocked(db.organization.findUnique).mockResolvedValueOnce(null);
		await expect(adminGetOrganizationDetail("nope", NOW)).resolves.toBeNull();
	});

	it("never selects metadata, API-key hashes or provider ids", async () => {
		vi.mocked(db.organization.findUnique).mockResolvedValueOnce(null);
		await adminGetOrganizationDetail("org-1", NOW);
		const select = vi.mocked(db.organization.findUnique).mock.calls[0]?.[0]
			.select;
		expect(select).not.toHaveProperty("metadata");
		expect(select).not.toHaveProperty("paymentsCustomerId");
		expect(select?.apiKeys).toMatchObject({
			select: {
				id: true,
				name: true,
				prefix: true,
				scopes: true,
				userId: true,
				createdAt: true,
				lastUsedAt: true,
				expiresAt: true,
				revokedAt: true,
			},
		});
		expect(JSON.stringify(select?.apiKeys)).not.toContain('"key"');
		expect(select?.purchases).toMatchObject({
			select: expect.not.objectContaining({ customerId: true }),
		});
	});

	it("lists pending invitations (expired ones too) with their inviter", async () => {
		vi.mocked(db.organization.findUnique).mockResolvedValueOnce(null);
		await adminGetOrganizationDetail("org-1", NOW);
		const select = vi.mocked(db.organization.findUnique).mock.calls[0]?.[0]
			.select;
		expect(select?.invitations).toMatchObject({
			where: { status: "pending" },
			select: {
				id: true,
				email: true,
				role: true,
				status: true,
				expiresAt: true,
				createdAt: true,
				user: { select: { id: true, name: true } },
			},
		});
	});

	it("flattens counts and names the inviter", async () => {
		vi.mocked(db.organization.findUnique).mockResolvedValueOnce({
			id: "org-1",
			name: "Acme",
			slug: "acme",
			logo: null,
			createdAt: NOW,
			_count: { members: 3 },
			members: [],
			invitations: [
				{
					id: "inv-1",
					email: "new@acme.test",
					role: "member",
					status: "pending",
					expiresAt: NOW,
					createdAt: NOW,
					user: { id: "user-1", name: "Owner" },
				},
			],
			purchases: [],
			apiKeys: [],
			creditBalances: [],
		} as never);
		const detail = await adminGetOrganizationDetail("org-1", NOW);
		expect(detail).toMatchObject({
			id: "org-1",
			memberCount: 3,
			invitations: [
				{
					id: "inv-1",
					inviter: { id: "user-1", name: "Owner" },
					expired: true,
				},
			],
		});
		expect(detail).not.toHaveProperty("_count");
		expect(detail?.invitations[0]).not.toHaveProperty("user");
	});
});

// ─── Members ────────────────────────────────────────────────────────────────

describe("countOrganizationOwners", () => {
	it("counts members holding the owner role", async () => {
		vi.mocked(db.member.count).mockResolvedValueOnce(2);
		await expect(countOrganizationOwners("org-1")).resolves.toBe(2);
		expect(db.member.count).toHaveBeenCalledWith({
			where: { organizationId: "org-1", ...OWNER_ROLE },
		});
	});
});

describe("getOrganizationMemberForAdmin", () => {
	it("only matches a member of the given organization", async () => {
		vi.mocked(db.member.findFirst).mockResolvedValueOnce(null);
		await expect(
			getOrganizationMemberForAdmin("org-1", "mem-9"),
		).resolves.toBeNull();
		expect(db.member.findFirst).toHaveBeenCalledWith({
			where: { id: "mem-9", organizationId: "org-1" },
			select: { id: true, organizationId: true, userId: true, role: true },
		});
	});
});

const OWNER = {
	id: "mem-1",
	organizationId: "org-1",
	userId: "user-1",
	role: "owner",
};
const MEMBER = {
	id: "mem-2",
	organizationId: "org-1",
	userId: "user-2",
	role: "member",
};

describe("adminSetOrganizationMemberRole", () => {
	it("reports not_found for a member of another organization", async () => {
		vi.mocked(db.member.findFirst).mockResolvedValueOnce(null);
		await expect(
			adminSetOrganizationMemberRole({
				organizationId: "org-1",
				memberId: "mem-x",
				role: "admin",
			}),
		).resolves.toEqual({ status: "not_found" });
		expect(db.member.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: "mem-x", organizationId: "org-1" },
			}),
		);
		expect(db.member.update).not.toHaveBeenCalled();
	});

	it("refuses to demote the last owner", async () => {
		vi.mocked(db.member.findFirst).mockResolvedValueOnce(OWNER as never);
		vi.mocked(db.member.count).mockResolvedValueOnce(0);
		await expect(
			adminSetOrganizationMemberRole({
				organizationId: "org-1",
				memberId: "mem-1",
				role: "admin",
			}),
		).resolves.toEqual({ status: "last_owner" });
		expect(db.member.count).toHaveBeenCalledWith({
			where: {
				organizationId: "org-1",
				id: { not: "mem-1" },
				...OWNER_ROLE,
			},
		});
		expect(db.member.update).not.toHaveBeenCalled();
	});

	it("demotes an owner while another owner remains, serializably", async () => {
		vi.mocked(db.member.findFirst).mockResolvedValueOnce(OWNER as never);
		vi.mocked(db.member.count).mockResolvedValueOnce(1);
		await expect(
			adminSetOrganizationMemberRole({
				organizationId: "org-1",
				memberId: "mem-1",
				role: "member",
			}),
		).resolves.toEqual({
			status: "updated",
			member: { ...OWNER, role: "member" },
			previousRole: "owner",
		});
		expect(db.member.update).toHaveBeenCalledWith({
			where: { id: "mem-1" },
			data: { role: "member" },
		});
		expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
			isolationLevel: "Serializable",
		});
	});

	it("promotes a member without counting owners", async () => {
		vi.mocked(db.member.findFirst).mockResolvedValueOnce(MEMBER as never);
		await expect(
			adminSetOrganizationMemberRole({
				organizationId: "org-1",
				memberId: "mem-2",
				role: "owner",
			}),
		).resolves.toMatchObject({ status: "updated", previousRole: "member" });
		expect(db.member.count).not.toHaveBeenCalled();
	});

	it("reports unchanged without writing when the role is the same", async () => {
		vi.mocked(db.member.findFirst).mockResolvedValueOnce(MEMBER as never);
		await expect(
			adminSetOrganizationMemberRole({
				organizationId: "org-1",
				memberId: "mem-2",
				role: "member",
			}),
		).resolves.toEqual({ status: "unchanged", member: MEMBER });
		expect(db.member.update).not.toHaveBeenCalled();
	});
});

describe("adminRemoveOrganizationMember", () => {
	it("reports not_found for a member of another organization", async () => {
		vi.mocked(db.member.findFirst).mockResolvedValueOnce(null);
		await expect(
			adminRemoveOrganizationMember({
				organizationId: "org-1",
				memberId: "mem-x",
			}),
		).resolves.toEqual({ status: "not_found" });
		expect(db.member.deleteMany).not.toHaveBeenCalled();
	});

	it("never removes the last owner", async () => {
		vi.mocked(db.member.findFirst).mockResolvedValueOnce(OWNER as never);
		vi.mocked(db.member.count).mockResolvedValueOnce(0);
		await expect(
			adminRemoveOrganizationMember({
				organizationId: "org-1",
				memberId: "mem-1",
			}),
		).resolves.toEqual({ status: "last_owner" });
		expect(db.member.deleteMany).not.toHaveBeenCalled();
	});

	it("deletes the member scoped to the organization, serializably", async () => {
		vi.mocked(db.member.findFirst).mockResolvedValueOnce(MEMBER as never);
		await expect(
			adminRemoveOrganizationMember({
				organizationId: "org-1",
				memberId: "mem-2",
			}),
		).resolves.toEqual({ status: "removed", member: MEMBER });
		expect(db.member.deleteMany).toHaveBeenCalledWith({
			where: { id: "mem-2", organizationId: "org-1" },
		});
		expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
			isolationLevel: "Serializable",
		});
	});
});

describe("adminTransferOrganizationOwnership", () => {
	it("reports not_found for a member of another organization", async () => {
		vi.mocked(db.member.findFirst).mockResolvedValueOnce(null);
		await expect(
			adminTransferOrganizationOwnership({
				organizationId: "org-1",
				memberId: "mem-x",
			}),
		).resolves.toEqual({ status: "not_found" });
		expect(db.member.updateMany).not.toHaveBeenCalled();
		expect(db.member.update).not.toHaveBeenCalled();
	});

	it("in one transaction: every other owner becomes admin, the target becomes owner", async () => {
		const calls: string[] = [];
		vi.mocked(db.member.findFirst).mockResolvedValueOnce(MEMBER as never);
		vi.mocked(db.member.updateMany).mockImplementationOnce((() => {
			calls.push("demote");
			return Promise.resolve({ count: 2 });
		}) as never);
		vi.mocked(db.member.update).mockImplementationOnce((() => {
			calls.push("promote");
			return Promise.resolve({});
		}) as never);
		vi.mocked(db.$transaction).mockImplementationOnce(((
			fn: (tx: typeof db) => unknown,
		) => {
			calls.push("begin");
			return Promise.resolve(fn(db)).then((result) => {
				calls.push("commit");
				return result;
			});
		}) as never);

		await expect(
			adminTransferOrganizationOwnership({
				organizationId: "org-1",
				memberId: "mem-2",
			}),
		).resolves.toEqual({
			status: "transferred",
			member: { ...MEMBER, role: "owner" },
			previousRole: "member",
			demotedOwners: 2,
		});
		expect(db.member.updateMany).toHaveBeenCalledWith({
			where: {
				organizationId: "org-1",
				id: { not: "mem-2" },
				...OWNER_ROLE,
			},
			data: { role: "admin" },
		});
		expect(db.member.update).toHaveBeenCalledWith({
			where: { id: "mem-2" },
			data: { role: "owner" },
		});
		expect(calls).toEqual(["begin", "demote", "promote", "commit"]);
		expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
			isolationLevel: "Serializable",
		});
	});
});

// ─── Invitations ────────────────────────────────────────────────────────────

describe("adminGetOrganizationInvitation", () => {
	it("only matches an invitation of the given organization, with inviter and org name", async () => {
		vi.mocked(db.invitation.findFirst).mockResolvedValueOnce(null);
		await expect(
			adminGetOrganizationInvitation("org-1", "inv-9"),
		).resolves.toBeNull();
		expect(db.invitation.findFirst).toHaveBeenCalledWith({
			where: { id: "inv-9", organizationId: "org-1" },
			select: {
				id: true,
				organizationId: true,
				email: true,
				role: true,
				status: true,
				expiresAt: true,
				createdAt: true,
				user: { select: { id: true, name: true, locale: true } },
				organization: { select: { name: true } },
			},
		});
	});

	it("renames the relation to inviter", async () => {
		vi.mocked(db.invitation.findFirst).mockResolvedValueOnce({
			id: "inv-1",
			organizationId: "org-1",
			email: "new@acme.test",
			role: "member",
			status: "pending",
			expiresAt: NOW,
			createdAt: NOW,
			user: { id: "user-1", name: "Owner", locale: "de" },
			organization: { name: "Acme" },
		} as never);
		const invitation = await adminGetOrganizationInvitation("org-1", "inv-1");
		expect(invitation).toMatchObject({
			id: "inv-1",
			inviter: { id: "user-1", name: "Owner", locale: "de" },
			organization: { name: "Acme" },
		});
		expect(invitation).not.toHaveProperty("user");
	});
});

describe("adminCancelOrganizationInvitation", () => {
	it("cancels only a pending invitation of the organization", async () => {
		vi.mocked(db.invitation.updateMany).mockResolvedValueOnce({ count: 1 });
		await expect(
			adminCancelOrganizationInvitation({
				organizationId: "org-1",
				invitationId: "inv-1",
			}),
		).resolves.toBe(1);
		expect(db.invitation.updateMany).toHaveBeenCalledWith({
			where: { id: "inv-1", organizationId: "org-1", status: "pending" },
			data: { status: "canceled" },
		});
	});
});

describe("adminExtendOrganizationInvitation", () => {
	it("moves expiresAt of a pending invitation of the organization", async () => {
		vi.mocked(db.invitation.updateMany).mockResolvedValueOnce({ count: 1 });
		await expect(
			adminExtendOrganizationInvitation({
				organizationId: "org-1",
				invitationId: "inv-1",
				expiresAt: NOW,
			}),
		).resolves.toBe(1);
		expect(db.invitation.updateMany).toHaveBeenCalledWith({
			where: { id: "inv-1", organizationId: "org-1", status: "pending" },
			data: { expiresAt: NOW },
		});
	});
});

// ─── Organization ───────────────────────────────────────────────────────────

describe("adminRenameOrganization", () => {
	it("changes the name only", async () => {
		vi.mocked(db.organization.update).mockResolvedValueOnce({
			id: "org-1",
			name: "Acme Inc",
			slug: "acme",
		} as never);
		await expect(adminRenameOrganization("org-1", "Acme Inc")).resolves.toEqual(
			{ id: "org-1", name: "Acme Inc", slug: "acme" },
		);
		expect(db.organization.update).toHaveBeenCalledWith({
			where: { id: "org-1" },
			data: { name: "Acme Inc" },
			select: { id: true, name: true, slug: true },
		});
	});
});

describe("adminDeleteOrganization", () => {
	it("deletes by id and reports the removed rows", async () => {
		vi.mocked(db.organization.deleteMany).mockResolvedValueOnce({ count: 1 });
		await expect(adminDeleteOrganization("org-1")).resolves.toBe(1);
		expect(db.organization.deleteMany).toHaveBeenCalledWith({
			where: { id: "org-1" },
		});
	});
});
