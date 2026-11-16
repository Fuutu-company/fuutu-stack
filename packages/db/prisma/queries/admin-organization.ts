import { db } from "../client";
import type { Prisma } from "../generated/client";
import { accessGatingWhere } from "./purchase";
import { roleListIncludes, roleListMatches } from "./role-list";
import { withSerializationRetry } from "./transaction";

/**
 * System-admin (support back office) organization reads and writes.
 * Support is not a member of the organizations it helps, so these run
 * without Better Auth's membership checks — the caller enforces system
 * admin permission, and `@fuutu/auth/admin-support` adds the side
 * effects the org plugin hooks would run. Every select is explicit: org
 * metadata, payment-provider ids and API-key hashes never leave here.
 */

export type AdminOrganizationSort = "createdAt" | "name" | "members";

export type AdminOrganizationFilters = {
	/** Name or slug (contains, case-insensitive) or exact organization id. */
	q?: string;
};

export type AdminOrganizationListParams = AdminOrganizationFilters & {
	sort?: AdminOrganizationSort;
	dir?: "asc" | "desc";
	page?: number;
	pageSize?: number;
	now?: Date;
};

const adminOrganizationWhere = (
	filters: AdminOrganizationFilters,
): Prisma.OrganizationWhereInput => {
	const and: Prisma.OrganizationWhereInput[] = [];
	const q = filters.q?.trim();
	if (q) {
		and.push({
			OR: [
				{ name: { contains: q, mode: "insensitive" } },
				{ slug: { contains: q, mode: "insensitive" } },
				{ id: q },
			],
		});
	}
	return { AND: and };
};

const orderBy = (
	sort: AdminOrganizationSort,
	dir: "asc" | "desc",
): Prisma.OrganizationOrderByWithRelationInput[] => [
	sort === "members" ? { members: { _count: dir } } : { [sort]: dir },
	{ id: "asc" },
];

/** Pending invitations that still reserve a seat (see countPendingInvitations). */
const openInvitations = (now: Date): Prisma.InvitationWhereInput => ({
	status: "pending",
	expiresAt: { gt: now },
});

const subscriptionSummary = {
	id: true,
	status: true,
	priceId: true,
	productId: true,
	quantity: true,
	currentPeriodEnd: true,
} satisfies Prisma.PurchaseSelect;

/**
 * Organizations for the back office — member count, unexpired pending
 * invitations and the subscription that currently gates access (newest
 * first, like `getActiveSubscriptionForOrganization`), or `null`.
 */
export async function adminListOrganizations(
	params: AdminOrganizationListParams,
) {
	const {
		sort = "createdAt",
		dir = "desc",
		page = 1,
		pageSize = 25,
		now = new Date(),
	} = params;
	const rows = await db.organization.findMany({
		where: adminOrganizationWhere(params),
		select: {
			id: true,
			name: true,
			slug: true,
			logo: true,
			createdAt: true,
			_count: {
				select: {
					members: true,
					invitations: { where: openInvitations(now) },
				},
			},
			purchases: {
				where: accessGatingWhere(now),
				select: subscriptionSummary,
				orderBy: [{ createdAt: "desc" }, { id: "asc" }],
				take: 1,
			},
		},
		orderBy: orderBy(sort, dir),
		take: pageSize,
		skip: (page - 1) * pageSize,
	});
	return rows.map(({ _count, purchases, ...org }) => ({
		...org,
		memberCount: _count.members,
		pendingInvitationCount: _count.invitations,
		activeSubscription: purchases[0] ?? null,
	}));
}

export type AdminOrganizationListItem = Awaited<
	ReturnType<typeof adminListOrganizations>
>[number];

export const adminCountOrganizations = (filters: AdminOrganizationFilters) =>
	db.organization.count({ where: adminOrganizationWhere(filters) });

/** Members and pending invitations shown on the detail (oldest first, capped). */
const DETAIL_MEMBER_LIMIT = 200;
const DETAIL_INVITATION_LIMIT = 200;

/**
 * Everything support needs about one organization: members with their
 * user, pending invitations (expired ones too — support resends them),
 * purchases, API keys by prefix and credit balances. `memberCount` is
 * the full count when the member list is capped. `null` when unknown.
 */
export async function adminGetOrganizationDetail(
	id: string,
	now: Date = new Date(),
) {
	const org = await db.organization.findUnique({
		where: { id },
		select: {
			id: true,
			name: true,
			slug: true,
			logo: true,
			createdAt: true,
			_count: { select: { members: true } },
			members: {
				select: {
					id: true,
					role: true,
					createdAt: true,
					user: {
						select: { id: true, name: true, email: true, image: true },
					},
				},
				orderBy: [{ createdAt: "asc" }, { id: "asc" }],
				take: DETAIL_MEMBER_LIMIT,
			},
			invitations: {
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
				orderBy: [{ createdAt: "desc" }, { id: "asc" }],
				take: DETAIL_INVITATION_LIMIT,
			},
			purchases: {
				select: {
					id: true,
					type: true,
					status: true,
					provider: true,
					priceId: true,
					productId: true,
					subscriptionId: true,
					quantity: true,
					currentPeriodEnd: true,
					createdAt: true,
				},
				orderBy: [{ createdAt: "desc" }, { id: "asc" }],
			},
			apiKeys: {
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
				orderBy: [{ createdAt: "desc" }, { id: "asc" }],
			},
			creditBalances: {
				select: {
					meterKey: true,
					recurringGranted: true,
					recurringConsumed: true,
					recurringPeriodEnd: true,
				},
				orderBy: { meterKey: "asc" },
			},
		},
	});
	if (!org) return null;
	const { _count, invitations, ...rest } = org;
	return {
		...rest,
		memberCount: _count.members,
		invitations: invitations.map(({ user, ...invitation }) => ({
			...invitation,
			inviter: user,
			expired: invitation.expiresAt <= now,
		})),
	};
}

export type AdminOrganizationDetail = NonNullable<
	Awaited<ReturnType<typeof adminGetOrganizationDetail>>
>;

/** Members holding the owner role — for the "at least one owner" guard. */
export const countOrganizationOwners = (organizationId: string) =>
	db.member.count({ where: { organizationId, ...roleListMatches("owner") } });

const memberRef = {
	id: true,
	organizationId: true,
	userId: true,
	role: true,
} satisfies Prisma.MemberSelect;

export type AdminOrganizationMember = {
	id: string;
	organizationId: string;
	userId: string;
	role: string;
};

/**
 * One member by member id — only when it belongs to `organizationId`, so
 * a member id of another organization never matches (IDOR).
 */
export const getOrganizationMemberForAdmin = (
	organizationId: string,
	memberId: string,
): Promise<AdminOrganizationMember | null> =>
	db.member.findFirst({
		where: { id: memberId, organizationId },
		select: memberRef,
	});

type Tx = Prisma.TransactionClient;

const otherOwnersCount = (tx: Tx, member: AdminOrganizationMember) =>
	tx.member.count({
		where: {
			organizationId: member.organizationId,
			id: { not: member.id },
			...roleListMatches("owner"),
		},
	});

/** Serializable so two concurrent demotions cannot both pass the owner check. */
const serializable = <T>(fn: (tx: Tx) => Promise<T>) =>
	withSerializationRetry(() =>
		db.$transaction(fn, { isolationLevel: "Serializable" }),
	);

export type OrgMemberRole = "owner" | "admin" | "member";

export type AdminSetMemberRoleResult =
	| { status: "not_found" }
	| { status: "last_owner" }
	| { status: "unchanged"; member: AdminOrganizationMember }
	| {
			status: "updated";
			member: AdminOrganizationMember;
			previousRole: string;
	  };

/**
 * Sets a member's role; the organization always keeps at least one
 * owner (`last_owner` otherwise).
 */
export const adminSetOrganizationMemberRole = (input: {
	organizationId: string;
	memberId: string;
	role: OrgMemberRole;
}): Promise<AdminSetMemberRoleResult> =>
	serializable(async (tx) => {
		const member = await tx.member.findFirst({
			where: { id: input.memberId, organizationId: input.organizationId },
			select: memberRef,
		});
		if (!member) return { status: "not_found" };
		if (member.role === input.role) return { status: "unchanged", member };
		if (
			roleListIncludes(member.role, "owner") &&
			input.role !== "owner" &&
			(await otherOwnersCount(tx, member)) === 0
		) {
			return { status: "last_owner" };
		}
		await tx.member.update({
			where: { id: member.id },
			data: { role: input.role },
		});
		return {
			status: "updated",
			member: { ...member, role: input.role },
			previousRole: member.role,
		};
	});

export type AdminRemoveMemberResult =
	| { status: "not_found" }
	| { status: "last_owner" }
	| { status: "removed"; member: AdminOrganizationMember };

/** Deletes a membership — never the organization's last owner. */
export const adminRemoveOrganizationMember = (input: {
	organizationId: string;
	memberId: string;
}): Promise<AdminRemoveMemberResult> =>
	serializable(async (tx) => {
		const member = await tx.member.findFirst({
			where: { id: input.memberId, organizationId: input.organizationId },
			select: memberRef,
		});
		if (!member) return { status: "not_found" };
		if (
			roleListIncludes(member.role, "owner") &&
			(await otherOwnersCount(tx, member)) === 0
		) {
			return { status: "last_owner" };
		}
		await tx.member.deleteMany({
			where: { id: member.id, organizationId: input.organizationId },
		});
		return { status: "removed", member };
	});

export type AdminTransferOwnershipResult =
	| { status: "not_found" }
	| {
			status: "transferred";
			member: AdminOrganizationMember;
			previousRole: string;
			/** Former owners now holding the admin role. */
			demotedOwners: number;
	  };

/**
 * Hands the organization to one member in a single transaction: every
 * other owner becomes admin, the target becomes the owner.
 */
export const adminTransferOrganizationOwnership = (input: {
	organizationId: string;
	memberId: string;
}): Promise<AdminTransferOwnershipResult> =>
	serializable(async (tx) => {
		const member = await tx.member.findFirst({
			where: { id: input.memberId, organizationId: input.organizationId },
			select: memberRef,
		});
		if (!member) return { status: "not_found" };
		const { count } = await tx.member.updateMany({
			where: {
				organizationId: input.organizationId,
				id: { not: member.id },
				...roleListMatches("owner"),
			},
			data: { role: "admin" },
		});
		await tx.member.update({
			where: { id: member.id },
			data: { role: "owner" },
		});
		return {
			status: "transferred",
			member: { ...member, role: "owner" },
			previousRole: member.role,
			demotedOwners: count,
		};
	});

/**
 * One invitation — only when it belongs to `organizationId` (IDOR) —
 * with its inviter (for the resent email) and the organization name.
 */
export async function adminGetOrganizationInvitation(
	organizationId: string,
	invitationId: string,
) {
	const row = await db.invitation.findFirst({
		where: { id: invitationId, organizationId },
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
	if (!row) return null;
	const { user, ...invitation } = row;
	return { ...invitation, inviter: user };
}

export type AdminOrganizationInvitation = NonNullable<
	Awaited<ReturnType<typeof adminGetOrganizationInvitation>>
>;

/**
 * Marks a pending invitation of the organization `canceled` (Better
 * Auth's status). Returns the rows changed — 0 when it is not pending.
 */
export async function adminCancelOrganizationInvitation(input: {
	organizationId: string;
	invitationId: string;
}): Promise<number> {
	const { count } = await db.invitation.updateMany({
		where: {
			id: input.invitationId,
			organizationId: input.organizationId,
			status: "pending",
		},
		data: { status: "canceled" },
	});
	return count;
}

/** Moves `expiresAt` of a pending invitation of the organization. */
export async function adminExtendOrganizationInvitation(input: {
	organizationId: string;
	invitationId: string;
	expiresAt: Date;
}): Promise<number> {
	const { count } = await db.invitation.updateMany({
		where: {
			id: input.invitationId,
			organizationId: input.organizationId,
			status: "pending",
		},
		data: { expiresAt: input.expiresAt },
	});
	return count;
}

/** Renames an organization — the slug (its URL) never changes here. */
export const adminRenameOrganization = (id: string, name: string) =>
	db.organization.update({
		where: { id },
		data: { name },
		select: { id: true, name: true, slug: true },
	});

/**
 * Deletes an organization; members, invitations, keys, purchases and
 * balances cascade (as with Better Auth's delete). Returns rows removed.
 */
export async function adminDeleteOrganization(id: string): Promise<number> {
	const { count } = await db.organization.deleteMany({ where: { id } });
	return count;
}
