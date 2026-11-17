import { db } from "../client";
import type { Prisma } from "../generated/client";
import { accessGatingWhere } from "./purchase";
import { roleListIncludes, roleListMatches } from "./role-list";
import { withSerializationRetry } from "./transaction";

/**
 * System-admin (support back office) reads and writes. Every select is
 * explicit: credentials — password hashes, session tokens, OAuth tokens,
 * TOTP secrets, API-key hashes — never leave this module.
 */

const activeBan = (now: Date): Prisma.UserWhereInput => ({
	banned: true,
	OR: [{ banExpires: null }, { banExpires: { gt: now } }],
});

/** Complement of `activeBan` — spelled out because NOT over NULL columns drops rows. */
const noActiveBan = (now: Date): Prisma.UserWhereInput => ({
	OR: [{ banned: null }, { banned: false }, { banExpires: { lte: now } }],
});

export type AdminUserFilters = {
	/** Email or name (contains, case-insensitive) or exact user id. */
	q?: string;
	role?: "admin" | "user";
	/** Active bans only — an expired temporary ban counts as not banned. */
	banned?: boolean;
	emailVerified?: boolean;
	now?: Date;
};

export type AdminUserSort = "createdAt" | "email" | "name";

export type AdminUserListParams = AdminUserFilters & {
	sort?: AdminUserSort;
	dir?: "asc" | "desc";
	page?: number;
	pageSize?: number;
};

const adminUserWhere = (filters: AdminUserFilters): Prisma.UserWhereInput => {
	const now = filters.now ?? new Date();
	const and: Prisma.UserWhereInput[] = [];
	const q = filters.q?.trim();
	if (q) {
		and.push({
			OR: [
				{ email: { contains: q, mode: "insensitive" } },
				{ name: { contains: q, mode: "insensitive" } },
				{ id: q },
			],
		});
	}
	if (filters.role === "admin") and.push(roleListMatches("admin"));
	if (filters.role === "user") {
		and.push({ OR: [{ role: null }, { NOT: roleListMatches("admin") }] });
	}
	if (filters.banned === true) and.push(activeBan(now));
	if (filters.banned === false) and.push(noActiveBan(now));
	if (filters.emailVerified !== undefined) {
		and.push({ emailVerified: filters.emailVerified });
	}
	return { AND: and };
};

export const adminListUsers = (params: AdminUserListParams) => {
	const { sort = "createdAt", dir = "desc", page = 1, pageSize = 25 } = params;
	return db.user.findMany({
		where: adminUserWhere(params),
		select: {
			id: true,
			name: true,
			email: true,
			emailVerified: true,
			image: true,
			role: true,
			banned: true,
			banReason: true,
			banExpires: true,
			createdAt: true,
		},
		orderBy: [{ [sort]: dir }, { id: "asc" }],
		take: pageSize,
		skip: (page - 1) * pageSize,
	});
};

export const adminCountUsers = (filters: AdminUserFilters) =>
	db.user.count({ where: adminUserWhere(filters) });

/** Live sessions shown on the user detail (newest first, capped). */
const DETAIL_SESSION_LIMIT = 50;

/**
 * Everything support needs about one user — auth methods as booleans and
 * counts, sessions without tokens, API keys by prefix. `null` when the
 * user does not exist.
 */
/** Purchase columns support sees — no provider metadata or customer ids. */
const purchaseSummary = {
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
} satisfies Prisma.PurchaseSelect;

const NEWEST_FIRST: Prisma.PurchaseOrderByWithRelationInput[] = [
	{ createdAt: "desc" },
	{ id: "asc" },
];

/**
 * Profile, sign-in methods, live sessions, API keys, personal purchases
 * and credits of one user, plus each organization they belong to with
 * its purchases and the subscription that gates its access (newest
 * first, like `getActiveSubscriptionForOrganization`) — billing usually
 * sits on the org, not the user. `null` when unknown.
 */
export async function adminGetUserDetail(id: string, now: Date = new Date()) {
	const [user, passwordAccounts] = await Promise.all([
		db.user.findUnique({
			where: { id },
			select: {
				id: true,
				name: true,
				email: true,
				emailVerified: true,
				image: true,
				role: true,
				banned: true,
				banReason: true,
				banExpires: true,
				twoFactorEnabled: true,
				locale: true,
				username: true,
				onboardingComplete: true,
				lastActiveOrganizationId: true,
				createdAt: true,
				updatedAt: true,
				accounts: {
					select: { id: true, providerId: true, createdAt: true },
					orderBy: [{ createdAt: "asc" }, { id: "asc" }],
				},
				_count: { select: { passkeys: true } },
				sessions: {
					where: { expiresAt: { gt: now } },
					select: {
						id: true,
						ipAddress: true,
						userAgent: true,
						createdAt: true,
						updatedAt: true,
						expiresAt: true,
						impersonatedBy: true,
						activeOrganizationId: true,
					},
					orderBy: [{ createdAt: "desc" }, { id: "asc" }],
					take: DETAIL_SESSION_LIMIT,
				},
				members: {
					select: {
						id: true,
						role: true,
						createdAt: true,
						organization: {
							select: {
								id: true,
								name: true,
								slug: true,
								purchases: { select: purchaseSummary, orderBy: NEWEST_FIRST },
							},
						},
					},
					orderBy: [{ createdAt: "asc" }, { id: "asc" }],
				},
				apiKeys: {
					select: {
						id: true,
						name: true,
						prefix: true,
						scopes: true,
						organizationId: true,
						createdAt: true,
						lastUsedAt: true,
						expiresAt: true,
						revokedAt: true,
					},
					orderBy: [{ createdAt: "desc" }, { id: "asc" }],
				},
				purchases: { select: purchaseSummary, orderBy: NEWEST_FIRST },
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
		}),
		// Which accounts carry a password — the hash itself is never selected.
		db.account.findMany({
			where: { userId: id, password: { not: null } },
			select: { id: true },
		}),
	]);
	if (!user) return null;
	const withPassword = new Set(passwordAccounts.map((account) => account.id));
	const { _count, accounts, members, twoFactorEnabled, ...rest } = user;
	const gating = members.length
		? await db.purchase.findMany({
				where: {
					organizationId: { in: members.map((m) => m.organization.id) },
					...accessGatingWhere(now),
				},
				select: { ...purchaseSummary, organizationId: true },
				orderBy: NEWEST_FIRST,
			})
		: [];
	return {
		...rest,
		twoFactorEnabled: twoFactorEnabled === true,
		passkeyCount: _count.passkeys,
		accounts: accounts.map((account) => ({
			...account,
			hasPassword: withPassword.has(account.id),
		})),
		memberships: members.map((member) => ({
			...member,
			organization: {
				...member.organization,
				activeSubscription:
					gating.find((p) => p.organizationId === member.organization.id) ??
					null,
			},
		})),
	};
}

export type AdminUserDetail = NonNullable<
	Awaited<ReturnType<typeof adminGetUserDetail>>
>;

/**
 * Role and ban state straight from the database — system-admin guards
 * must not trust the (up to 5 minutes) cookie-cached session.
 */
export const getUserAccessState = (id: string) =>
	db.user.findUnique({
		where: { id },
		select: {
			id: true,
			email: true,
			emailVerified: true,
			role: true,
			banned: true,
			banExpires: true,
		},
	});

/** Users holding the system `admin` role — for the last-admin guard. */
export const countAdminUsers = () =>
	db.user.count({ where: roleListMatches("admin") });

export type AdminSetSystemRoleResult =
	| { status: "not_found" }
	| { status: "unchanged" }
	| { status: "last_admin" }
	| { status: "updated"; previousRole: string | null };

/**
 * Sets a user's system role. Demoting an admin checks that another admin
 * remains in the same Serializable transaction — two admins demoting each
 * other at once cannot both pass (`last_admin`).
 */
export const adminSetSystemRole = (input: {
	userId: string;
	role: "admin" | "user";
}): Promise<AdminSetSystemRoleResult> =>
	withSerializationRetry(() =>
		db.$transaction(
			async (tx): Promise<AdminSetSystemRoleResult> => {
				const user = await tx.user.findUnique({
					where: { id: input.userId },
					select: { id: true, role: true },
				});
				if (!user) return { status: "not_found" };
				const isAdmin = roleListIncludes(user.role, "admin");
				if (isAdmin === (input.role === "admin")) {
					return { status: "unchanged" };
				}
				if (isAdmin) {
					const otherAdmins = await tx.user.count({
						where: { id: { not: user.id }, ...roleListMatches("admin") },
					});
					if (otherAdmins === 0) return { status: "last_admin" };
				}
				await tx.user.update({
					where: { id: user.id },
					data: { role: input.role },
				});
				return { status: "updated", previousRole: user.role };
			},
			{ isolationLevel: "Serializable" },
		),
	);

/**
 * Organizations the user owns alone (no other owner) — deleting the user
 * would leave them without an owner.
 */
export async function listSoleOwnedOrganizations(userId: string) {
	const rows = await db.member.findMany({
		where: { userId, ...roleListMatches("owner") },
		select: {
			organization: {
				select: {
					id: true,
					name: true,
					slug: true,
					members: {
						where: roleListMatches("owner"),
						select: { userId: true },
					},
				},
			},
		},
	});
	return rows
		.filter(({ organization }) =>
			organization.members.every((owner) => owner.userId === userId),
		)
		.map(({ organization: { id, name, slug } }) => ({ id, name, slug }));
}

/** True when another user already signs in with `email` (case-insensitive). */
export async function isEmailTaken(
	email: string,
	exceptUserId?: string,
): Promise<boolean> {
	const existing = await db.user.findFirst({
		where: {
			email: { equals: email, mode: "insensitive" },
			...(exceptUserId ? { NOT: { id: exceptUserId } } : {}),
		},
		select: { id: true },
	});
	return existing !== null;
}

/**
 * Ends one session of `userId` by session id — tokens never round-trip
 * through the client. Returns the number of sessions removed (0 or 1).
 */
export async function adminRevokeUserSession(input: {
	userId: string;
	sessionId: string;
}): Promise<number> {
	const { count } = await db.session.deleteMany({
		where: { id: input.sessionId, userId: input.userId },
	});
	return count;
}

/**
 * True while the session row of `userId` exists — read from the database,
 * not the (up to 5 minutes) cookie-cached session.
 */
export async function isUserSessionLive(input: {
	userId: string;
	sessionId: string;
}): Promise<boolean> {
	const row = await db.session.findFirst({
		where: { id: input.sessionId, userId: input.userId },
		select: { id: true },
	});
	return row !== null;
}

/**
 * Ends every impersonation session `adminUserId` started — they belong to
 * the impersonated users, so revoking the admin's own sessions misses
 * them. Returns the number of sessions removed.
 */
export async function deleteSessionsImpersonatedBy(
	adminUserId: string,
): Promise<number> {
	const { count } = await db.session.deleteMany({
		where: { impersonatedBy: adminUserId },
	});
	return count;
}

/**
 * Turns two-factor authentication off: deletes the TOTP secrets and
 * backup codes and clears `twoFactorEnabled`. Returns the removed rows.
 */
export async function adminResetTwoFactor(userId: string): Promise<number> {
	const [removed] = await db.$transaction([
		db.twoFactor.deleteMany({ where: { userId } }),
		db.user.update({
			where: { id: userId },
			data: { twoFactorEnabled: false },
			select: { id: true },
		}),
	]);
	return removed.count;
}
