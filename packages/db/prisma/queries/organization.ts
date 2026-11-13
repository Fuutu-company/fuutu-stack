import { db } from "../client";

export const getOrganizationBySlug = (slug: string) =>
	db.organization.findUnique({ where: { slug } });

export const getOrganizationById = (id: string) =>
	db.organization.findUnique({ where: { id } });

/**
 * Org + members (with member email) — used by org-access resolution for
 * API-key contexts, where Better Auth endpoints can't resolve a session
 * from `x-api-key` headers.
 */
export const getOrganizationWithMembers = (id: string) =>
	db.organization.findUnique({
		where: { id },
		include: {
			members: {
				include: { user: { select: { email: true } } },
				orderBy: [{ createdAt: "asc" }, { id: "asc" }],
			},
		},
	});

/**
 * One member of an organization, matched by member id, user id or user
 * email — a bounded lookup for member mutations (no full member list).
 */
export const findOrganizationMember = async (
	organizationId: string,
	idOrUserIdOrEmail: string,
) => {
	const row = await db.member.findFirst({
		where: {
			organizationId,
			OR: [
				{ id: idOrUserIdOrEmail },
				{ userId: idOrUserIdOrEmail },
				{ user: { email: idOrUserIdOrEmail } },
			],
		},
		select: {
			id: true,
			userId: true,
			role: true,
			user: { select: { email: true } },
		},
	});
	if (!row) return null;
	return {
		id: row.id,
		userId: row.userId,
		role: row.role,
		email: row.user.email,
	};
};

export const listOrganizationsForUser = (userId: string) =>
	db.organization.findMany({
		where: { members: { some: { userId } } },
		orderBy: [{ createdAt: "desc" }, { id: "asc" }],
	});

export const setOrganizationPaymentsCustomerId = (
	id: string,
	paymentsCustomerId: string,
) => db.organization.update({ where: { id }, data: { paymentsCustomerId } });

export const getInvitationOrganizationId = (invitationId: string) =>
	db.invitation.findUnique({
		where: { id: invitationId },
		select: { organizationId: true },
	});

export const findPendingInvitation = (email: string) =>
	db.invitation.findFirst({
		where: {
			email: { equals: email, mode: "insensitive" },
			status: "pending",
			expiresAt: { gt: new Date() },
		},
		select: { id: true },
	});

/**
 * Invite-bound lookup: the pending invitation must exist by id AND match
 * the signing-up email (case-insensitive) — binds `/sign-up/email` to the
 * exact invite token so an invitee's link can't be reused for another
 * address.
 */
export const findPendingInvitationById = (id: string, email: string) =>
	db.invitation.findFirst({
		where: {
			id,
			email: { equals: email, mode: "insensitive" },
			status: "pending",
			expiresAt: { gt: new Date() },
		},
		select: { id: true },
	});

export const countOrganizationMembers = (organizationId: string) =>
	db.member.count({ where: { organizationId } });

/**
 * Pending, unexpired invitations for an org — seat-limit checks count
 * these as reserved seats (same filter shape as findPendingInvitation).
 */
export const countPendingInvitations = (organizationId: string) =>
	db.invitation.count({
		where: {
			organizationId,
			status: "pending",
			expiresAt: { gt: new Date() },
		},
	});

export const isOrganizationMember = async (
	userId: string,
	organizationId: string,
): Promise<boolean> =>
	(await db.member.count({ where: { userId, organizationId } })) > 0;

/**
 * The user's member role in an org, or `null` when they are not a member —
 * API-key verification re-checks this on every request so a removed
 * member's org keys stop working immediately.
 */
export const getOrganizationMemberRole = async (
	organizationId: string,
	userId: string,
): Promise<string | null> => {
	const member = await db.member.findFirst({
		where: { organizationId, userId },
		select: { role: true },
	});
	return member?.role ?? null;
};

export type UserMembership = {
	id: string;
	name: string;
	slug: string;
	role: string;
};

/** Every org the user belongs to, with their member role in it. */
export const listMembershipsForUser = async (
	userId: string,
): Promise<UserMembership[]> => {
	const members = await db.member.findMany({
		where: { userId },
		orderBy: [{ createdAt: "asc" }, { id: "asc" }],
		select: {
			role: true,
			organization: { select: { id: true, name: true, slug: true } },
		},
	});
	return members.map(({ role, organization }) => ({ ...organization, role }));
};

export const countOrganizationsForUser = (userId: string) =>
	db.organization.count({ where: { members: { some: { userId } } } });

/**
 * Pending invitations addressed to an email — the no-org landing/onboarding
 * surfaces list these so invitees can accept without any membership yet.
 * Better Auth's list-user-invitations endpoint 403s for org-less users,
 * so this is queried server-side and passed down as props.
 */
export const listPendingInvitationsForUser = (email: string) =>
	db.invitation.findMany({
		where: {
			email: { equals: email, mode: "insensitive" },
			status: "pending",
			expiresAt: { gt: new Date() },
		},
		select: {
			id: true,
			role: true,
			organization: { select: { name: true, slug: true } },
		},
		orderBy: [{ createdAt: "desc" }, { id: "asc" }],
	});
