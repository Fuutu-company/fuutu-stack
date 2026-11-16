import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../prisma/client", () => ({
	db: {
		$transaction: vi.fn(),
		user: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			findFirst: vi.fn(),
			count: vi.fn(),
			update: vi.fn(),
		},
		account: { findMany: vi.fn() },
		member: { findMany: vi.fn() },
		purchase: { findMany: vi.fn() },
		session: { deleteMany: vi.fn(), findFirst: vi.fn() },
		twoFactor: { deleteMany: vi.fn() },
		auditLog: { findMany: vi.fn(), count: vi.fn() },
	},
}));

import { db } from "../../prisma/client";
import {
	adminCountUsers,
	adminGetUserDetail,
	adminListUsers,
	adminResetTwoFactor,
	adminRevokeUserSession,
	adminSetSystemRole,
	countAdminUsers,
	deleteSessionsImpersonatedBy,
	getUserAccessState,
	isEmailTaken,
	isUserSessionLive,
	listSoleOwnedOrganizations,
} from "../../prisma/queries/admin";
import {
	countFilteredAuditLogs,
	listFilteredAuditLogs,
} from "../../prisma/queries/audit-log";

const NOW = new Date("2026-06-01T12:00:00Z");

/** Matches role "admin" in a Better Auth comma-separated role list. */
const ADMIN_ROLE = {
	OR: [
		{ role: { equals: "admin" } },
		{ role: { startsWith: "admin," } },
		{ role: { endsWith: ",admin" } },
		{ role: { contains: ",admin," } },
	],
};

const ACTIVE_BAN = {
	banned: true,
	OR: [{ banExpires: null }, { banExpires: { gt: NOW } }],
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("adminListUsers", () => {
	it("defaults to newest first, page 1 of 25, with a stable tiebreak", async () => {
		vi.mocked(db.user.findMany).mockResolvedValueOnce([] as never);
		await adminListUsers({});
		expect(db.user.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { AND: [] },
				orderBy: [{ createdAt: "desc" }, { id: "asc" }],
				take: 25,
				skip: 0,
			}),
		);
	});

	it("searches email and name case-insensitively and ids exactly", async () => {
		vi.mocked(db.user.findMany).mockResolvedValueOnce([] as never);
		await adminListUsers({ q: "  Ada  " });
		expect(db.user.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					AND: [
						{
							OR: [
								{ email: { contains: "Ada", mode: "insensitive" } },
								{ name: { contains: "Ada", mode: "insensitive" } },
								{ id: "Ada" },
							],
						},
					],
				},
			}),
		);
	});

	it("filters admins by role list membership", async () => {
		vi.mocked(db.user.findMany).mockResolvedValueOnce([] as never);
		await adminListUsers({ role: "admin" });
		expect(db.user.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { AND: [ADMIN_ROLE] } }),
		);
	});

	it("counts users with a null role as role user", async () => {
		vi.mocked(db.user.findMany).mockResolvedValueOnce([] as never);
		await adminListUsers({ role: "user" });
		expect(db.user.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { AND: [{ OR: [{ role: null }, { NOT: ADMIN_ROLE }] }] },
			}),
		);
	});

	it("treats an expired temporary ban as not banned", async () => {
		vi.mocked(db.user.findMany).mockResolvedValue([] as never);
		await adminListUsers({ banned: true, now: NOW });
		expect(db.user.findMany).toHaveBeenLastCalledWith(
			expect.objectContaining({ where: { AND: [ACTIVE_BAN] } }),
		);
		await adminListUsers({ banned: false, now: NOW });
		expect(db.user.findMany).toHaveBeenLastCalledWith(
			expect.objectContaining({
				where: {
					AND: [
						{
							OR: [
								{ banned: null },
								{ banned: false },
								{ banExpires: { lte: NOW } },
							],
						},
					],
				},
			}),
		);
	});

	it("sorts, paginates and filters on verification", async () => {
		vi.mocked(db.user.findMany).mockResolvedValueOnce([] as never);
		await adminListUsers({
			emailVerified: false,
			sort: "email",
			dir: "asc",
			page: 3,
			pageSize: 10,
		});
		expect(db.user.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { AND: [{ emailVerified: false }] },
				orderBy: [{ email: "asc" }, { id: "asc" }],
				take: 10,
				skip: 20,
			}),
		);
	});

	it("never selects credentials", async () => {
		vi.mocked(db.user.findMany).mockResolvedValueOnce([] as never);
		await adminListUsers({});
		const select = vi.mocked(db.user.findMany).mock.calls[0]?.[0]?.select;
		expect(select).toBeDefined();
		expect(Object.keys(select ?? {})).not.toEqual(
			expect.arrayContaining(["accounts", "sessions", "twoFactors"]),
		);
	});
});

describe("adminCountUsers", () => {
	it("counts with the same filters as the list", async () => {
		vi.mocked(db.user.count).mockResolvedValueOnce(4 as never);
		const total = await adminCountUsers({ role: "admin", emailVerified: true });
		expect(total).toBe(4);
		expect(db.user.count).toHaveBeenCalledWith({
			where: { AND: [ADMIN_ROLE, { emailVerified: true }] },
		});
	});
});

describe("adminGetUserDetail", () => {
	const userRow = {
		id: "u1",
		name: "Ada",
		email: "ada@fuutu.local",
		emailVerified: true,
		image: null,
		role: "user",
		banned: false,
		banReason: null,
		banExpires: null,
		twoFactorEnabled: null,
		createdAt: NOW,
		updatedAt: NOW,
		accounts: [
			{ id: "acc-1", providerId: "credential", createdAt: NOW },
			{ id: "acc-2", providerId: "github", createdAt: NOW },
		],
		_count: { passkeys: 2 },
		sessions: [],
		members: [],
		apiKeys: [],
		purchases: [],
		creditBalances: [],
	};

	it("returns null for an unknown user", async () => {
		vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
		vi.mocked(db.account.findMany).mockResolvedValueOnce([] as never);
		expect(await adminGetUserDetail("nope")).toBeNull();
	});

	it("reports password presence per account without reading credentials", async () => {
		vi.mocked(db.user.findUnique).mockResolvedValueOnce(userRow as never);
		vi.mocked(db.account.findMany).mockResolvedValueOnce([
			{ id: "acc-1" },
		] as never);

		const detail = await adminGetUserDetail("u1", NOW);

		expect(detail?.accounts).toEqual([
			{
				id: "acc-1",
				providerId: "credential",
				createdAt: NOW,
				hasPassword: true,
			},
			{ id: "acc-2", providerId: "github", createdAt: NOW, hasPassword: false },
		]);
		expect(detail?.passkeyCount).toBe(2);
		expect(detail?.twoFactorEnabled).toBe(false);
		expect(db.account.findMany).toHaveBeenCalledWith({
			where: { userId: "u1", password: { not: null } },
			select: { id: true },
		});

		const select = vi.mocked(db.user.findUnique).mock.calls[0]?.[0]?.select;
		expect(select?.accounts).toEqual({
			select: { id: true, providerId: true, createdAt: true },
			orderBy: [{ createdAt: "asc" }, { id: "asc" }],
		});
		// Session rows without their token, live sessions only.
		expect(select?.sessions).toEqual({
			where: { expiresAt: { gt: NOW } },
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
			take: 50,
		});
		// API keys by prefix — never the stored hash.
		expect(select?.apiKeys).toEqual({
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
		});
		expect(JSON.stringify(select)).not.toMatch(
			/"(token|password|key|secret|backupCodes|accessToken|refreshToken|idToken)"/,
		);
	});

	it("lists each organization with its purchases and the subscription that gates access", async () => {
		const purchase = {
			id: "pur-1",
			type: "SUBSCRIPTION",
			status: "ACTIVE",
			provider: "creem",
			priceId: "price_pro",
			productId: "prod_pro",
			subscriptionId: "sub_1",
			quantity: 3,
			currentPeriodEnd: NOW,
			createdAt: NOW,
		};
		vi.mocked(db.user.findUnique).mockResolvedValueOnce({
			...userRow,
			members: [
				{
					id: "mem-1",
					role: "owner",
					createdAt: NOW,
					organization: {
						id: "org-1",
						name: "Acme",
						slug: "acme",
						purchases: [purchase],
					},
				},
				{
					id: "mem-2",
					role: "member",
					createdAt: NOW,
					organization: {
						id: "org-2",
						name: "Beta",
						slug: "beta",
						purchases: [],
					},
				},
			],
		} as never);
		vi.mocked(db.account.findMany).mockResolvedValueOnce([] as never);
		vi.mocked(db.purchase.findMany).mockResolvedValueOnce([
			{ ...purchase, organizationId: "org-1" },
		] as never);

		const detail = await adminGetUserDetail("u1", NOW);

		expect(
			detail?.memberships.map((m) => ({
				org: m.organization.slug,
				purchases: m.organization.purchases.map((p) => p.id),
				active: m.organization.activeSubscription?.id ?? null,
			})),
		).toEqual([
			{ org: "acme", purchases: ["pur-1"], active: "pur-1" },
			{ org: "beta", purchases: [], active: null },
		]);
		// Same rule as the org's own access check (accessGatingWhere).
		expect(db.purchase.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					organizationId: { in: ["org-1", "org-2"] },
					type: "SUBSCRIPTION",
					OR: [
						{ status: { in: ["ACTIVE", "TRIALING"] } },
						{ status: "SCHEDULED_CANCEL", currentPeriodEnd: { gt: NOW } },
					],
				},
			}),
		);
		const select = vi.mocked(db.user.findUnique).mock.calls[0]?.[0]?.select;
		expect(JSON.stringify(select?.members)).not.toMatch(/customerId|metadata/);
	});

	it("drops the internal _count from the result", async () => {
		vi.mocked(db.user.findUnique).mockResolvedValueOnce(userRow as never);
		vi.mocked(db.account.findMany).mockResolvedValueOnce([] as never);
		const detail = await adminGetUserDetail("u1", NOW);
		expect(detail).not.toHaveProperty("_count");
	});
});

describe("getUserAccessState", () => {
	it("reads role and ban state fresh from the database", async () => {
		vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
		await getUserAccessState("u1");
		expect(db.user.findUnique).toHaveBeenCalledWith({
			where: { id: "u1" },
			select: {
				id: true,
				email: true,
				emailVerified: true,
				role: true,
				banned: true,
				banExpires: true,
			},
		});
	});
});

describe("countAdminUsers", () => {
	it("counts users holding the admin role", async () => {
		vi.mocked(db.user.count).mockResolvedValueOnce(2 as never);
		expect(await countAdminUsers()).toBe(2);
		expect(db.user.count).toHaveBeenCalledWith({ where: ADMIN_ROLE });
	});
});

describe("listSoleOwnedOrganizations", () => {
	it("returns only organizations where the user is the single owner", async () => {
		vi.mocked(db.member.findMany).mockResolvedValueOnce([
			{
				organization: {
					id: "org-solo",
					name: "Solo",
					slug: "solo",
					members: [{ userId: "u1" }],
				},
			},
			{
				organization: {
					id: "org-shared",
					name: "Shared",
					slug: "shared",
					members: [{ userId: "u1" }, { userId: "u2" }],
				},
			},
		] as never);

		expect(await listSoleOwnedOrganizations("u1")).toEqual([
			{ id: "org-solo", name: "Solo", slug: "solo" },
		]);
		const ownerRole = {
			OR: [
				{ role: { equals: "owner" } },
				{ role: { startsWith: "owner," } },
				{ role: { endsWith: ",owner" } },
				{ role: { contains: ",owner," } },
			],
		};
		expect(db.member.findMany).toHaveBeenCalledWith({
			where: { userId: "u1", ...ownerRole },
			select: {
				organization: {
					select: {
						id: true,
						name: true,
						slug: true,
						members: { where: ownerRole, select: { userId: true } },
					},
				},
			},
		});
	});
});

describe("isEmailTaken", () => {
	it("matches case-insensitively and ignores the user being edited", async () => {
		vi.mocked(db.user.findFirst).mockResolvedValueOnce({ id: "u2" } as never);
		expect(await isEmailTaken("Ada@Fuutu.local", "u1")).toBe(true);
		expect(db.user.findFirst).toHaveBeenCalledWith({
			where: {
				email: { equals: "Ada@Fuutu.local", mode: "insensitive" },
				NOT: { id: "u1" },
			},
			select: { id: true },
		});
	});

	it("is false when nobody else uses the address", async () => {
		vi.mocked(db.user.findFirst).mockResolvedValueOnce(null);
		expect(await isEmailTaken("free@fuutu.local")).toBe(false);
	});
});

describe("adminRevokeUserSession", () => {
	it("deletes the session only when it belongs to the user", async () => {
		vi.mocked(db.session.deleteMany).mockResolvedValueOnce({
			count: 1,
		} as never);
		expect(
			await adminRevokeUserSession({ userId: "u1", sessionId: "s1" }),
		).toBe(1);
		expect(db.session.deleteMany).toHaveBeenCalledWith({
			where: { id: "s1", userId: "u1" },
		});
	});
});

describe("isUserSessionLive", () => {
	it("is true while the session row of that user exists", async () => {
		vi.mocked(db.session.findFirst).mockResolvedValueOnce({
			id: "s1",
		} as never);
		expect(await isUserSessionLive({ userId: "u1", sessionId: "s1" })).toBe(
			true,
		);
		expect(db.session.findFirst).toHaveBeenCalledWith({
			where: { id: "s1", userId: "u1" },
			select: { id: true },
		});
	});

	it("is false once the row is gone", async () => {
		vi.mocked(db.session.findFirst).mockResolvedValueOnce(null);
		expect(await isUserSessionLive({ userId: "u1", sessionId: "s1" })).toBe(
			false,
		);
	});
});

describe("adminSetSystemRole", () => {
	beforeEach(() => {
		vi.mocked(db.$transaction).mockImplementation(((
			fn: (tx: typeof db) => unknown,
		) => Promise.resolve(fn(db))) as never);
	});

	const target = (role: string | null) =>
		vi.mocked(db.user.findUnique).mockResolvedValueOnce({
			id: "admin-2",
			role,
		} as never);

	it("checks the last admin and demotes in one Serializable transaction", async () => {
		target("admin");
		vi.mocked(db.user.count).mockResolvedValueOnce(1);
		await expect(
			adminSetSystemRole({ userId: "admin-2", role: "user" }),
		).resolves.toEqual({ status: "updated", previousRole: "admin" });
		expect(db.user.count).toHaveBeenCalledWith({
			where: { id: { not: "admin-2" }, ...ADMIN_ROLE },
		});
		expect(db.user.update).toHaveBeenCalledWith({
			where: { id: "admin-2" },
			data: { role: "user" },
		});
		expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
			isolationLevel: "Serializable",
		});
	});

	it("never demotes the last admin", async () => {
		target("admin");
		vi.mocked(db.user.count).mockResolvedValueOnce(0);
		await expect(
			adminSetSystemRole({ userId: "admin-2", role: "user" }),
		).resolves.toEqual({ status: "last_admin" });
		expect(db.user.update).not.toHaveBeenCalled();
	});

	it("treats a role list containing admin as admin", async () => {
		target("user,admin");
		vi.mocked(db.user.count).mockResolvedValueOnce(0);
		await expect(
			adminSetSystemRole({ userId: "admin-2", role: "user" }),
		).resolves.toEqual({ status: "last_admin" });
	});

	it("promotes without counting admins", async () => {
		target(null);
		await expect(
			adminSetSystemRole({ userId: "admin-2", role: "admin" }),
		).resolves.toEqual({ status: "updated", previousRole: null });
		expect(db.user.count).not.toHaveBeenCalled();
		expect(db.user.update).toHaveBeenCalledWith({
			where: { id: "admin-2" },
			data: { role: "admin" },
		});
	});

	it.each([
		["admin", "admin"],
		["user", "user"],
		[null, "user"],
	] as const)("leaves role %s alone when set to %s", async (current, role) => {
		target(current);
		await expect(
			adminSetSystemRole({ userId: "admin-2", role }),
		).resolves.toEqual({ status: "unchanged" });
		expect(db.user.update).not.toHaveBeenCalled();
	});

	it("reports an unknown user", async () => {
		vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
		await expect(
			adminSetSystemRole({ userId: "nope", role: "admin" }),
		).resolves.toEqual({ status: "not_found" });
	});
});

describe("deleteSessionsImpersonatedBy", () => {
	it("ends every impersonation session the admin started", async () => {
		vi.mocked(db.session.deleteMany).mockResolvedValueOnce({
			count: 2,
		} as never);
		expect(await deleteSessionsImpersonatedBy("admin-2")).toBe(2);
		expect(db.session.deleteMany).toHaveBeenCalledWith({
			where: { impersonatedBy: "admin-2" },
		});
	});
});

describe("adminResetTwoFactor", () => {
	it("removes TOTP secrets and turns the flag off in one transaction", async () => {
		vi.mocked(db.twoFactor.deleteMany).mockReturnValueOnce("delete" as never);
		vi.mocked(db.user.update).mockReturnValueOnce("update" as never);
		vi.mocked(db.$transaction).mockResolvedValueOnce([
			{ count: 1 },
			{},
		] as never);

		expect(await adminResetTwoFactor("u1")).toBe(1);
		expect(db.twoFactor.deleteMany).toHaveBeenCalledWith({
			where: { userId: "u1" },
		});
		expect(db.user.update).toHaveBeenCalledWith({
			where: { id: "u1" },
			data: { twoFactorEnabled: false },
			select: { id: true },
		});
		expect(db.$transaction).toHaveBeenCalledWith(["delete", "update"]);
	});
});

describe("listFilteredAuditLogs / countFilteredAuditLogs", () => {
	it("keeps the plain userId + action filter unchanged", async () => {
		vi.mocked(db.auditLog.findMany).mockResolvedValueOnce([] as never);
		await listFilteredAuditLogs({ userId: "u1", action: "auth.sign_up" });
		expect(db.auditLog.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { userId: "u1", action: "auth.sign_up" },
			}),
		);
	});

	it("filters on actor, target, prefix and date range", async () => {
		vi.mocked(db.auditLog.count).mockResolvedValueOnce(0 as never);
		const from = new Date("2026-01-01T00:00:00Z");
		const to = new Date("2026-02-01T00:00:00Z");
		await countFilteredAuditLogs({
			actorUserId: "admin-1",
			organizationId: "org-1",
			actionPrefix: "admin.",
			targetUserId: "u2",
			targetOrganizationId: "org-2",
			from,
			to,
		});
		expect(db.auditLog.count).toHaveBeenCalledWith({
			where: {
				organizationId: "org-1",
				AND: [
					{ userId: "admin-1" },
					{ action: { startsWith: "admin." } },
					{ metadata: { path: ["targetUserId"], equals: "u2" } },
					{ metadata: { path: ["targetOrganizationId"], equals: "org-2" } },
					{ createdAt: { gte: from, lte: to } },
				],
			},
		});
	});

	it("builds a user timeline from own rows and rows targeting the user", async () => {
		vi.mocked(db.auditLog.findMany).mockResolvedValueOnce([] as never);
		await listFilteredAuditLogs({ timelineUserId: "u2" });
		expect(db.auditLog.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					AND: [
						{
							OR: [
								{ userId: "u2" },
								{ metadata: { path: ["targetUserId"], equals: "u2" } },
							],
						},
					],
				},
			}),
		);
	});

	it("builds an organization timeline from org rows and support actions on it", async () => {
		vi.mocked(db.auditLog.count).mockResolvedValueOnce(0 as never);
		await countFilteredAuditLogs({ timelineOrganizationId: "org-1" });
		expect(db.auditLog.count).toHaveBeenCalledWith({
			where: {
				AND: [
					{
						OR: [
							{ organizationId: "org-1" },
							{
								metadata: {
									path: ["targetOrganizationId"],
									equals: "org-1",
								},
							},
						],
					},
				],
			},
		});
	});
});
