import { db } from "../client";

export const getOrganizationBySlug = (slug: string) =>
	db.organization.findUnique({ where: { slug } });

export const getOrganizationById = (id: string) =>
	db.organization.findUnique({ where: { id } });

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
