import { readFileSync } from "node:fs";
import { join } from "node:path";
import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@fuutu/ai", () => ({
	resolveAIProvider: vi.fn(),
}));

vi.mock("@fuutu/auth", () => ({
	auth: { api: { getSession: vi.fn(), getFullOrganization: vi.fn() } },
}));

vi.mock("@fuutu/auth/admin-support", () => ({
	supportRemoveMember: vi.fn(),
	supportSetMemberRole: vi.fn(),
	supportTransferOwnership: vi.fn(),
	supportResendInvitation: vi.fn(),
	supportDeleteOrganization: vi.fn(),
}));

vi.mock("@fuutu/db", () => ({
	getUserAccessState: vi.fn(),
	adminListOrganizations: vi.fn(),
	adminCountOrganizations: vi.fn(),
	adminGetOrganizationDetail: vi.fn(),
	adminGetOrganizationInvitation: vi.fn(),
	adminCancelOrganizationInvitation: vi.fn(),
	adminRenameOrganization: vi.fn(),
	getOrganizationById: vi.fn(),
}));

vi.mock("@fuutu/webhooks", () => ({ dispatchEvent: vi.fn() }));

vi.mock("@fuutu/payments/config.server", () => ({
	getPlanIdForProductId: (productId: string) =>
		({ prod_pro: "pro", prod_ent: "enterprise" })[productId],
}));

const audit = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("@fuutu/logs", async (importOriginal) => ({
	...(await importOriginal<typeof import("@fuutu/logs")>()),
	createAuditLogger: () => audit,
}));

// Records every rate-limit bucket checked — proves each procedure is wired
// to its endpoint budget.
const rateLimit = vi.hoisted(() => ({ keys: [] as string[] }));
vi.mock("@fuutu/utils/rate-limit", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@fuutu/utils/rate-limit")>();
	return {
		...actual,
		defaultRateLimitStore: {
			async check(key: string, limit: { windowMs: number }) {
				rateLimit.keys.push(key);
				return {
					allowed: true,
					remaining: 1,
					resetAt: Date.now() + limit.windowMs,
				};
			},
		},
	};
});

const { auth } = await import("@fuutu/auth");
const support = await import("@fuutu/auth/admin-support");
const db = await import("@fuutu/db");
const { dispatchEvent } = await import("@fuutu/webhooks");
const { adminRouter } = await import("../modules/admin/router");
const { openApiHandler } = await import("../orpc/handler");

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ADMIN_ID = "admin-1";
const ORG_ID = "org-1";
const REASON = "Support ticket #4711";
const NOW = new Date("2026-06-01T12:00:00Z");

const admin = makeUser({
	id: ADMIN_ID,
	email: "admin@fuutu.local",
	role: "admin",
});

const STATES: Record<string, Record<string, unknown>> = {
	[ADMIN_ID]: { email: "admin@fuutu.local", role: "admin" },
	"owner-7": { email: "owner@acme.test", role: "user" },
	"user-2": { email: "ada@acme.test", role: "user" },
};

const ORG = {
	id: ORG_ID,
	name: "Acme",
	slug: "acme",
	logo: null,
	createdAt: NOW,
	metadata: '{"internal":"secret"}',
	paymentsCustomerId: "cus_123",
};

const MEMBER = {
	id: "mem-2",
	organizationId: ORG_ID,
	userId: "user-2",
	role: "member",
};

const INVITATION = {
	id: "inv-1",
	organizationId: ORG_ID,
	email: "new@acme.test",
	role: "member",
	status: "pending",
	expiresAt: NOW,
	createdAt: NOW,
	inviter: { id: "owner-7", name: "Grace", locale: null },
	organization: { name: "Acme" },
};

const adminContext = () => makeSession<Context>(admin);

function impersonatedContext(): Context {
	const ctx = makeSession<Context>(admin);
	(ctx.session?.session as { impersonatedBy?: string }).impersonatedBy =
		"admin-9";
	return ctx;
}

function apiKeyContext(organizationId: string | null): Context {
	return {
		session: { user: admin },
		headers: new Headers(),
		apiKey: { id: "key-1", organizationId },
	} as unknown as Context;
}

beforeEach(() => {
	vi.clearAllMocks();
	rateLimit.keys = [];
	vi.mocked(db.getUserAccessState).mockImplementation(((id: string) => {
		const state = STATES[id];
		return Promise.resolve(
			state ? { id, banned: false, banExpires: null, ...state } : null,
		);
	}) as never);
	vi.mocked(db.adminListOrganizations).mockResolvedValue([]);
	vi.mocked(db.adminCountOrganizations).mockResolvedValue(0);
	vi.mocked(db.adminGetOrganizationDetail).mockResolvedValue({
		id: ORG_ID,
		purchases: [],
	} as never);
	vi.mocked(db.getOrganizationById).mockResolvedValue(ORG as never);
	vi.mocked(db.adminRenameOrganization).mockResolvedValue({
		id: ORG_ID,
		name: "Acme Inc",
		slug: "acme",
	});
	vi.mocked(db.adminGetOrganizationInvitation).mockResolvedValue(INVITATION);
	vi.mocked(db.adminCancelOrganizationInvitation).mockResolvedValue(1);
	vi.mocked(support.supportSetMemberRole).mockResolvedValue({
		status: "updated",
		member: { ...MEMBER, role: "admin" },
		previousRole: "member",
	});
	vi.mocked(support.supportRemoveMember).mockResolvedValue({
		status: "removed",
		member: MEMBER,
	});
	vi.mocked(support.supportTransferOwnership).mockResolvedValue({
		status: "transferred",
		member: { ...MEMBER, role: "owner" },
		previousRole: "member",
		demotedOwners: 1,
	});
	vi.mocked(support.supportResendInvitation).mockResolvedValue({
		status: "resent",
		emailSent: true,
		invitation: {
			id: "inv-1",
			email: "new@acme.test",
			role: "member",
			status: "pending",
			expiresAt: NOW,
		},
	});
	vi.mocked(support.supportDeleteOrganization).mockResolvedValue(true);
	vi.mocked(dispatchEvent).mockResolvedValue({ enqueued: 1 });
});

const orgs = adminRouter.organizations;

/**
 * Every admin.organizations procedure, with an input the admin happy path
 * accepts. `endpoint` is the rate-limit budget it must draw from.
 */
const ORG_PROCEDURES = [
	{ name: "list", procedure: orgs.list, input: {}, endpoint: "adminRead" },
	{
		name: "get",
		procedure: orgs.get,
		input: { organizationId: ORG_ID },
		endpoint: "adminRead",
	},
	{
		name: "rename",
		procedure: orgs.rename,
		input: { organizationId: ORG_ID, name: "Acme Inc" },
		endpoint: "adminMutation",
	},
	{
		name: "updateMemberRole",
		procedure: orgs.updateMemberRole,
		input: {
			organizationId: ORG_ID,
			memberId: "mem-2",
			role: "admin",
			reason: REASON,
		},
		endpoint: "adminMutation",
	},
	{
		name: "removeMember",
		procedure: orgs.removeMember,
		input: { organizationId: ORG_ID, memberId: "mem-2", reason: REASON },
		endpoint: "adminMutation",
	},
	{
		name: "transferOwnership",
		procedure: orgs.transferOwnership,
		input: { organizationId: ORG_ID, memberId: "mem-2", reason: REASON },
		endpoint: "adminMutation",
	},
	{
		name: "resendInvitation",
		procedure: orgs.resendInvitation,
		input: { organizationId: ORG_ID, invitationId: "inv-1" },
		endpoint: "adminMutation",
	},
	{
		name: "cancelInvitation",
		procedure: orgs.cancelInvitation,
		input: { organizationId: ORG_ID, invitationId: "inv-1" },
		endpoint: "adminMutation",
	},
	{
		name: "delete",
		procedure: orgs.delete,
		input: { organizationId: ORG_ID, reason: REASON, confirmSlug: "acme" },
		endpoint: "adminMutation",
	},
] as const;

// ─── Access matrix ──────────────────────────────────────────────────────────

describe.each(ORG_PROCEDURES)("admin.organizations access: $name", (entry) => {
	// `call` is typed per procedure; the table erases that on purpose.
	const run = (context: Context, input: unknown = entry.input) =>
		call(entry.procedure as never, input as never, { context });

	it("rejects unauthenticated callers with 401", async () => {
		await expect(run(makeSession<Context>(null))).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("rejects a system role user with 403", async () => {
		await expect(
			run(makeSession<Context>(makeUser({ id: "user-2" }))),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("rejects the org's own owner passing their organization id (no org scope)", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue({
			id: ORG_ID,
			members: [{ userId: "owner-7", role: "owner" }],
		} as never);
		const owner = makeUser({ id: "owner-7", role: "user" });
		await expect(
			run(makeSession<Context>(owner), {
				...entry.input,
				organizationId: ORG_ID,
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("rejects an admin's personal API key with 403", async () => {
		await expect(run(apiKeyContext(null))).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
	});

	it("rejects an org API key passing its own organization id with 403", async () => {
		await expect(
			run(apiKeyContext(ORG_ID), { ...entry.input, organizationId: ORG_ID }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("rejects an impersonation session with 403", async () => {
		await expect(run(impersonatedContext())).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
	});

	it("rejects an admin demoted since the session was cached", async () => {
		vi.mocked(db.getUserAccessState).mockResolvedValueOnce({
			id: ADMIN_ID,
			email: "admin@fuutu.local",
			role: "user",
			banned: false,
			banExpires: null,
		});
		await expect(run(adminContext())).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
	});

	it("serves a system admin and draws from its rate-limit budget", async () => {
		await expect(run(adminContext())).resolves.toBeDefined();
		expect(rateLimit.keys).toContain(`${entry.endpoint}:${ADMIN_ID}`);
	});
});

// ─── Audit shape ────────────────────────────────────────────────────────────

function lastAudit() {
	return audit.record.mock.calls.at(-1)?.[0];
}

function expectAudit(action: string, metadata: Record<string, unknown>) {
	const event = lastAudit();
	expect(event).toMatchObject({
		action,
		userId: ADMIN_ID,
		// Customer org audit pages must not list support actions.
		organizationId: null,
		metadata,
	});
	// Ids only — the audit log outlives the user row.
	expect(JSON.stringify(event?.metadata)).not.toContain("@");
}

// ─── Reads ──────────────────────────────────────────────────────────────────

describe("admin.organizations.list", () => {
	it("passes search, sort and pagination and maps each subscription to its plan", async () => {
		vi.mocked(db.adminListOrganizations).mockResolvedValue([
			{
				id: ORG_ID,
				name: "Acme",
				slug: "acme",
				logo: null,
				createdAt: NOW,
				memberCount: 4,
				pendingInvitationCount: 1,
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
				name: "Legacy",
				slug: "legacy",
				logo: null,
				createdAt: NOW,
				memberCount: 1,
				pendingInvitationCount: 0,
				activeSubscription: {
					id: "pur-2",
					status: "TRIALING",
					priceId: "prod_ent",
					productId: null,
					quantity: 1,
					currentPeriodEnd: null,
				},
			},
			{
				id: "org-3",
				name: "Free",
				slug: "free",
				logo: null,
				createdAt: NOW,
				memberCount: 1,
				pendingInvitationCount: 0,
				activeSubscription: null,
			},
		]);
		vi.mocked(db.adminCountOrganizations).mockResolvedValue(51);
		const result = await call(
			orgs.list,
			{ q: "acme", sort: "members", dir: "asc", page: "2", pageSize: "25" },
			{ context: adminContext() },
		);
		expect(db.adminListOrganizations).toHaveBeenCalledWith({
			q: "acme",
			sort: "members",
			dir: "asc",
			page: 2,
			pageSize: 25,
		});
		expect(db.adminCountOrganizations).toHaveBeenCalledWith({ q: "acme" });
		expect(result).toMatchObject({
			page: 2,
			pageSize: 25,
			total: 51,
			totalPages: 3,
		});
		expect(result.items.map((org) => org.activeSubscription?.planId)).toEqual([
			"pro",
			"enterprise",
			undefined,
		]);
		expect(result.items[2]?.activeSubscription).toBeNull();
	});

	it("reports null for a product no plan maps to", async () => {
		vi.mocked(db.adminListOrganizations).mockResolvedValue([
			{
				id: ORG_ID,
				name: "Acme",
				slug: "acme",
				logo: null,
				createdAt: NOW,
				memberCount: 1,
				pendingInvitationCount: 0,
				activeSubscription: {
					id: "pur-1",
					status: "ACTIVE",
					priceId: "price_x",
					productId: "prod_unknown",
					quantity: 1,
					currentPeriodEnd: null,
				},
			},
		]);
		const result = await call(orgs.list, {}, { context: adminContext() });
		expect(result.items[0]?.activeSubscription?.planId).toBeNull();
	});

	it("rejects an unknown sort and caps the page size at 100", async () => {
		await expect(
			call(orgs.list, { sort: "slug" } as never, { context: adminContext() }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			call(orgs.list, { pageSize: 101 }, { context: adminContext() }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("caps the page number at 100 000", async () => {
		await expect(
			call(orgs.list, { page: 100_001 }, { context: adminContext() }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});

describe("admin.organizations.get", () => {
	it("returns the detail with each purchase mapped to its plan", async () => {
		vi.mocked(db.adminGetOrganizationDetail).mockResolvedValue({
			id: ORG_ID,
			purchases: [
				{ id: "pur-1", priceId: "price_pro", productId: "prod_pro" },
				{ id: "pur-2", priceId: "topup", productId: "topup" },
			],
		} as never);
		const detail = await call(
			orgs.get,
			{ organizationId: ORG_ID },
			{ context: adminContext() },
		);
		expect(db.adminGetOrganizationDetail).toHaveBeenCalledWith(ORG_ID);
		expect(detail.purchases.map((p) => p.planId)).toEqual(["pro", null]);
	});

	it("returns 404 for an unknown organization", async () => {
		vi.mocked(db.adminGetOrganizationDetail).mockResolvedValue(null);
		await expect(
			call(orgs.get, { organizationId: "nope" }, { context: adminContext() }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});

// ─── rename ─────────────────────────────────────────────────────────────────

describe("admin.organizations.rename", () => {
	it("renames (slug untouched), dispatches organization.updated and audits", async () => {
		const result = await call(
			orgs.rename,
			{ organizationId: ORG_ID, name: "  Acme Inc ", reason: REASON },
			{ context: adminContext() },
		);
		expect(db.adminRenameOrganization).toHaveBeenCalledWith(ORG_ID, "Acme Inc");
		expect(result).toEqual({
			success: true,
			changed: true,
			organization: { id: ORG_ID, name: "Acme Inc", slug: "acme" },
		});
		expect(dispatchEvent).toHaveBeenCalledWith({
			event: "organization.updated",
			organizationId: ORG_ID,
			payload: { organizationId: ORG_ID, name: "Acme Inc" },
		});
		expectAudit("admin.org.rename", {
			targetOrganizationId: ORG_ID,
			reason: REASON,
			changedFields: ["name"],
		});
	});

	it("does not accept a slug", async () => {
		await call(
			orgs.rename,
			{ organizationId: ORG_ID, name: "Acme Inc", slug: "evil" } as never,
			{ context: adminContext() },
		);
		expect(db.adminRenameOrganization).toHaveBeenCalledWith(ORG_ID, "Acme Inc");
	});

	it("is a no-op when the name does not change", async () => {
		const result = await call(
			orgs.rename,
			{ organizationId: ORG_ID, name: "Acme" },
			{ context: adminContext() },
		);
		expect(result).toMatchObject({ success: true, changed: false });
		expect(db.adminRenameOrganization).not.toHaveBeenCalled();
		expect(dispatchEvent).not.toHaveBeenCalled();
		expect(audit.record).not.toHaveBeenCalled();
	});

	it("returns 404 for an unknown organization", async () => {
		vi.mocked(db.getOrganizationById).mockResolvedValue(null);
		await expect(
			call(
				orgs.rename,
				{ organizationId: "nope", name: "X" },
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("still succeeds when the webhook dispatch fails", async () => {
		vi.mocked(dispatchEvent).mockRejectedValueOnce(new Error("queue down"));
		await expect(
			call(
				orgs.rename,
				{ organizationId: ORG_ID, name: "Acme Inc" },
				{ context: adminContext() },
			),
		).resolves.toMatchObject({ success: true });
		expect(audit.record).toHaveBeenCalled();
	});
});

// ─── updateMemberRole ───────────────────────────────────────────────────────

describe("admin.organizations.updateMemberRole", () => {
	const input = {
		organizationId: ORG_ID,
		memberId: "mem-2",
		role: "admin" as const,
		reason: REASON,
	};

	it("changes the role and audits the target user", async () => {
		const result = await call(orgs.updateMemberRole, input, {
			context: adminContext(),
		});
		expect(support.supportSetMemberRole).toHaveBeenCalledWith({
			organizationId: ORG_ID,
			memberId: "mem-2",
			role: "admin",
		});
		expect(result).toEqual({
			success: true,
			changed: true,
			member: { id: "mem-2", userId: "user-2", role: "admin" },
		});
		expectAudit("admin.org.member_role_update", {
			targetOrganizationId: ORG_ID,
			targetUserId: "user-2",
			reason: REASON,
			changedFields: ["role"],
		});
	});

	it("returns 404 for a member of another organization (IDOR)", async () => {
		vi.mocked(support.supportSetMemberRole).mockResolvedValue({
			status: "not_found",
		});
		await expect(
			call(orgs.updateMemberRole, input, { context: adminContext() }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(audit.record).not.toHaveBeenCalled();
	});

	it("keeps at least one owner", async () => {
		vi.mocked(support.supportSetMemberRole).mockResolvedValue({
			status: "last_owner",
		});
		await expect(
			call(orgs.updateMemberRole, input, { context: adminContext() }),
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(audit.record).not.toHaveBeenCalled();
	});

	it("is a no-op when the role does not change", async () => {
		vi.mocked(support.supportSetMemberRole).mockResolvedValue({
			status: "unchanged",
			member: MEMBER,
		});
		await expect(
			call(
				orgs.updateMemberRole,
				{ ...input, role: "member" },
				{ context: adminContext() },
			),
		).resolves.toMatchObject({ success: true, changed: false });
		expect(audit.record).not.toHaveBeenCalled();
	});

	it("requires a reason and only accepts org roles", async () => {
		await expect(
			call(orgs.updateMemberRole, { ...input, reason: undefined } as never, {
				context: adminContext(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			call(orgs.updateMemberRole, { ...input, role: "superadmin" } as never, {
				context: adminContext(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(support.supportSetMemberRole).not.toHaveBeenCalled();
	});
});

// ─── removeMember ───────────────────────────────────────────────────────────

describe("admin.organizations.removeMember", () => {
	const input = { organizationId: ORG_ID, memberId: "mem-2", reason: REASON };

	it("removes through admin-support, dispatches member.removed and audits", async () => {
		await expect(
			call(orgs.removeMember, input, { context: adminContext() }),
		).resolves.toEqual({ success: true });
		expect(support.supportRemoveMember).toHaveBeenCalledWith({
			organizationId: ORG_ID,
			memberId: "mem-2",
		});
		expect(dispatchEvent).toHaveBeenCalledWith({
			event: "member.removed",
			organizationId: ORG_ID,
			payload: { organizationId: ORG_ID, memberIdOrEmail: "mem-2" },
		});
		expectAudit("admin.org.member_remove", {
			targetOrganizationId: ORG_ID,
			targetUserId: "user-2",
			reason: REASON,
		});
	});

	it("returns 404 for a member of another organization (IDOR)", async () => {
		vi.mocked(support.supportRemoveMember).mockResolvedValue({
			status: "not_found",
		});
		await expect(
			call(orgs.removeMember, input, { context: adminContext() }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(dispatchEvent).not.toHaveBeenCalled();
		expect(audit.record).not.toHaveBeenCalled();
	});

	it("never removes the last owner", async () => {
		vi.mocked(support.supportRemoveMember).mockResolvedValue({
			status: "last_owner",
		});
		await expect(
			call(orgs.removeMember, input, { context: adminContext() }),
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(dispatchEvent).not.toHaveBeenCalled();
	});

	it("requires a reason", async () => {
		await expect(
			call(
				orgs.removeMember,
				{ organizationId: ORG_ID, memberId: "mem-2" } as never,
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});

// ─── transferOwnership ──────────────────────────────────────────────────────

describe("admin.organizations.transferOwnership", () => {
	const input = { organizationId: ORG_ID, memberId: "mem-2", reason: REASON };

	it("transfers through admin-support and audits the new owner", async () => {
		await expect(
			call(orgs.transferOwnership, input, { context: adminContext() }),
		).resolves.toEqual({ success: true, changed: true, demotedOwners: 1 });
		expect(support.supportTransferOwnership).toHaveBeenCalledWith({
			organizationId: ORG_ID,
			memberId: "mem-2",
		});
		expectAudit("admin.org.ownership_transfer", {
			targetOrganizationId: ORG_ID,
			targetUserId: "user-2",
			reason: REASON,
			changedFields: ["role"],
		});
	});

	it("is a no-op for the organization's sole owner", async () => {
		vi.mocked(support.supportTransferOwnership).mockResolvedValue({
			status: "transferred",
			member: { ...MEMBER, role: "owner" },
			previousRole: "owner",
			demotedOwners: 0,
		});
		await expect(
			call(orgs.transferOwnership, input, { context: adminContext() }),
		).resolves.toEqual({ success: true, changed: false, demotedOwners: 0 });
		expect(audit.record).not.toHaveBeenCalled();
	});

	it("returns 404 for a member of another organization (IDOR)", async () => {
		vi.mocked(support.supportTransferOwnership).mockResolvedValue({
			status: "not_found",
		});
		await expect(
			call(orgs.transferOwnership, input, { context: adminContext() }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("requires a reason", async () => {
		await expect(
			call(
				orgs.transferOwnership,
				{ organizationId: ORG_ID, memberId: "mem-2" } as never,
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});

// ─── resendInvitation ───────────────────────────────────────────────────────

describe("admin.organizations.resendInvitation", () => {
	const input = { organizationId: ORG_ID, invitationId: "inv-1" };

	it("resends through admin-support and audits the invitation, not the email", async () => {
		await expect(
			call(orgs.resendInvitation, input, { context: adminContext() }),
		).resolves.toEqual({
			success: true,
			emailSent: true,
			invitation: {
				id: "inv-1",
				email: "new@acme.test",
				role: "member",
				status: "pending",
				expiresAt: NOW,
			},
		});
		expect(support.supportResendInvitation).toHaveBeenCalledWith({
			organizationId: ORG_ID,
			invitationId: "inv-1",
		});
		expectAudit("admin.org.invitation_resend", {
			targetOrganizationId: ORG_ID,
			targetInvitationId: "inv-1",
			changedFields: ["expiresAt"],
		});
	});

	it("returns 404 for an invitation of another organization (IDOR)", async () => {
		vi.mocked(support.supportResendInvitation).mockResolvedValue({
			status: "not_found",
		});
		await expect(
			call(orgs.resendInvitation, input, { context: adminContext() }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(audit.record).not.toHaveBeenCalled();
	});

	it("only resends pending invitations", async () => {
		vi.mocked(support.supportResendInvitation).mockResolvedValue({
			status: "not_pending",
		});
		await expect(
			call(orgs.resendInvitation, input, { context: adminContext() }),
		).rejects.toMatchObject({ code: "CONFLICT" });
	});

	it("maps the seat-limit error to a typed 402", async () => {
		// The shape of Better Auth's seat-limit APIError (hooks/seat-limit.ts).
		vi.mocked(support.supportResendInvitation).mockRejectedValue(
			Object.assign(new Error("Organization seat limit reached"), {
				name: "APIError",
				statusCode: 402,
				body: {
					message: "Organization seat limit reached",
					seatsTotal: 5,
					upgradeUrl: "/billing?org=acme",
				},
			}),
		);
		await expect(
			call(orgs.resendInvitation, input, { context: adminContext() }),
		).rejects.toMatchObject({
			code: "PAYMENT_REQUIRED",
			data: { seatsTotal: 5, upgradeUrl: "/billing?org=acme" },
		});
	});
});

// ─── cancelInvitation ───────────────────────────────────────────────────────

describe("admin.organizations.cancelInvitation", () => {
	const input = { organizationId: ORG_ID, invitationId: "inv-1" };

	it("cancels a pending invitation of the organization and audits", async () => {
		await expect(
			call(
				orgs.cancelInvitation,
				{ ...input, reason: REASON },
				{ context: adminContext() },
			),
		).resolves.toEqual({ success: true });
		expect(db.adminGetOrganizationInvitation).toHaveBeenCalledWith(
			ORG_ID,
			"inv-1",
		);
		expect(db.adminCancelOrganizationInvitation).toHaveBeenCalledWith({
			organizationId: ORG_ID,
			invitationId: "inv-1",
		});
		expectAudit("admin.org.invitation_cancel", {
			targetOrganizationId: ORG_ID,
			targetInvitationId: "inv-1",
			reason: REASON,
			changedFields: ["status"],
		});
	});

	it("returns 404 for an invitation of another organization (IDOR)", async () => {
		vi.mocked(db.adminGetOrganizationInvitation).mockResolvedValue(null);
		await expect(
			call(orgs.cancelInvitation, input, { context: adminContext() }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(db.adminCancelOrganizationInvitation).not.toHaveBeenCalled();
	});

	it("only cancels pending invitations", async () => {
		vi.mocked(db.adminGetOrganizationInvitation).mockResolvedValue({
			...INVITATION,
			status: "accepted",
		});
		await expect(
			call(orgs.cancelInvitation, input, { context: adminContext() }),
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(db.adminCancelOrganizationInvitation).not.toHaveBeenCalled();
	});

	it("reports a conflict when it stopped being pending meanwhile", async () => {
		vi.mocked(db.adminCancelOrganizationInvitation).mockResolvedValue(0);
		await expect(
			call(orgs.cancelInvitation, input, { context: adminContext() }),
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(audit.record).not.toHaveBeenCalled();
	});
});

// ─── delete ─────────────────────────────────────────────────────────────────

describe("admin.organizations.delete", () => {
	const input = {
		organizationId: ORG_ID,
		reason: REASON,
		confirmSlug: "acme",
	};

	it("deletes after the typed slug confirmation and audits", async () => {
		await expect(
			call(orgs.delete, input, { context: adminContext() }),
		).resolves.toEqual({ success: true });
		expect(support.supportDeleteOrganization).toHaveBeenCalledWith(ORG_ID);
		expectAudit("admin.org.delete", {
			targetOrganizationId: ORG_ID,
			reason: REASON,
		});
	});

	it("aborts with 502 when a subscription could not be cancelled", async () => {
		vi.mocked(support.supportDeleteOrganization).mockRejectedValueOnce(
			Object.assign(new Error("Subscriptions could not be cancelled"), {
				name: "SubscriptionCancellationError",
			}),
		);
		await expect(
			call(orgs.delete, input, { context: adminContext() }),
		).rejects.toMatchObject({ code: "BAD_GATEWAY", status: 502 });
		// Audited before the delete started; the failed row says nothing came of it.
		expect(audit.record.mock.calls.map(([event]) => event.action)).toEqual([
			"admin.org.delete",
			"admin.org.delete_failed",
		]);
		expectAudit("admin.org.delete_failed", {
			targetOrganizationId: ORG_ID,
			reason: REASON,
		});
	});

	it("writes the audit row before anything is deleted", async () => {
		await call(orgs.delete, input, { context: adminContext() });
		expect(audit.record).toHaveBeenCalledOnce();
		expect(audit.record.mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(support.supportDeleteOrganization).mock
				.invocationCallOrder[0] ?? 0,
		);
	});

	it("records delete_failed when the organization is gone by delete time", async () => {
		vi.mocked(support.supportDeleteOrganization).mockResolvedValueOnce(false);
		await expect(
			call(orgs.delete, input, { context: adminContext() }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(audit.record.mock.calls.map(([event]) => event.action)).toEqual([
			"admin.org.delete",
			"admin.org.delete_failed",
		]);
	});

	it("refuses when the confirmation is not the organization's slug", async () => {
		await expect(
			call(
				orgs.delete,
				{ ...input, confirmSlug: "acme-2" },
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(support.supportDeleteOrganization).not.toHaveBeenCalled();
		expect(audit.record).not.toHaveBeenCalled();
	});

	it("refuses the organization's name in place of its slug", async () => {
		vi.mocked(db.getOrganizationById).mockResolvedValue({
			...ORG,
			name: "Acme Corp",
			slug: "acme-corp",
		} as never);
		await expect(
			call(
				orgs.delete,
				{ ...input, confirmSlug: "Acme Corp" },
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("returns 404 for an unknown organization", async () => {
		vi.mocked(db.getOrganizationById).mockResolvedValue(null);
		await expect(
			call(orgs.delete, input, { context: adminContext() }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(support.supportDeleteOrganization).not.toHaveBeenCalled();
	});

	it("requires a reason", async () => {
		await expect(
			call(
				orgs.delete,
				{ organizationId: ORG_ID, confirmSlug: "acme" } as never,
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});

// ─── Permission per procedure ───────────────────────────────────────────────

describe("admin.organizations permissions", () => {
	// Every admin holds all three today, so only the declaration shows a
	// procedure asking for the wrong one (e.g. delete behind UPDATE).
	const PROCEDURE_DIR = join(
		import.meta.dirname,
		"../modules/admin/organizations/procedures",
	);
	it.each([
		["list.ts", "VIEW"],
		["get.ts", "VIEW"],
		["rename.ts", "UPDATE"],
		["update-member-role.ts", "UPDATE"],
		["remove-member.ts", "UPDATE"],
		["transfer-ownership.ts", "UPDATE"],
		["resend-invitation.ts", "UPDATE"],
		["cancel-invitation.ts", "UPDATE"],
		["delete.ts", "DELETE"],
	])("%s requires ADMIN_ORGANIZATION.%s", (file, permission) => {
		const source = readFileSync(join(PROCEDURE_DIR, file), "utf8");
		const declared = [
			...source.matchAll(
				/systemAdminProcedure\(\s*PERMISSIONS\.ADMIN_ORGANIZATION\.(\w+)/g,
			),
		].map((match) => match[1]);
		expect(declared).toEqual([permission]);
	});
});

// ─── Wire (OpenAPI) ─────────────────────────────────────────────────────────

describe("OpenAPI routes", () => {
	const wireContext = () => ({
		session: makeSession<Context>(admin).session,
		headers: new Headers(),
		apiKey: null,
	});

	it("DELETE /api/admin/organizations/{id} reads reason and confirmSlug from the body", async () => {
		const { response } = await openApiHandler.handle(
			new Request(`http://localhost/api/admin/organizations/${ORG_ID}`, {
				method: "DELETE",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ reason: REASON, confirmSlug: "acme" }),
			}),
			{ prefix: "/api", context: wireContext() },
		);
		expect(response?.status).toBe(200);
		expect(support.supportDeleteOrganization).toHaveBeenCalledWith(ORG_ID);
	});

	it("GET /api/admin/organizations coerces query numbers", async () => {
		const { response } = await openApiHandler.handle(
			new Request(
				"http://localhost/api/admin/organizations?page=2&pageSize=10&sort=name",
			),
			{ prefix: "/api", context: wireContext() },
		);
		expect(response?.status).toBe(200);
		expect(db.adminListOrganizations).toHaveBeenCalledWith(
			expect.objectContaining({ page: 2, pageSize: 10, sort: "name" }),
		);
	});
});
