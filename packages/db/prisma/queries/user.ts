import { db } from "../client";

export const getUserById = (id: string) =>
	db.user.findUnique({ where: { id } });

export const getUserByEmail = (email: string) =>
	db.user.findUnique({ where: { email } });

export const getUserByUsername = (username: string) =>
	db.user.findUnique({ where: { username } });

export const setOnboardingComplete = (id: string) =>
	db.user.update({ where: { id }, data: { onboardingComplete: true } });

export const setLastActiveOrganization = (
	id: string,
	organizationId: string | null,
) =>
	db.user.update({
		where: { id },
		data: { lastActiveOrganizationId: organizationId },
	});

export const setPaymentsCustomerId = (id: string, paymentsCustomerId: string) =>
	db.user.update({ where: { id }, data: { paymentsCustomerId } });
