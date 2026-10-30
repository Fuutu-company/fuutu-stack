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
			},
		},
	});

export const listOrganizationsForUser = (userId: string) =>
	db.organization.findMany({
		where: { members: { some: { userId } } },
		orderBy: { createdAt: "desc" },
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

export const countOrganizationsForUser = (userId: string) =>
	db.organization.count({ where: { members: { some: { userId } } } });
