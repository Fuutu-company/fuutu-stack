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

export const updateUserProfile = (
	id: string,
	data: { name?: string; image?: string },
) => db.user.update({ where: { id }, data });

/**
 * Atomically claims the right to emit the org-scoped `user.created`
 * webhook for this user. `updateMany` on the flag returns `count > 0`
 * for exactly the first caller — both `afterAddMember` and
 * `afterAcceptInvitation` fire on the same join, so the claim makes the
 * double-fire harmless.
 */
export const claimUserCreatedEvent = async (
	userId: string,
): Promise<boolean> => {
	const { count } = await db.user.updateMany({
		where: { id: userId, userCreatedEventSent: false },
		data: { userCreatedEventSent: true },
	});
	return count > 0;
};

/**
 * Releases a `user.created` claim after a failed dispatch so a later
 * membership hook can retry the emit instead of the event being lost.
 */
export const resetUserCreatedEvent = async (userId: string): Promise<void> => {
	await db.user.updateMany({
		where: { id: userId },
		data: { userCreatedEventSent: false },
	});
};
