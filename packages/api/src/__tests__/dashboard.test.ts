import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";
import { buildActivitySeries } from "../modules/dashboard/activity-series";
import {
	areaForAuditAction,
	type FeedItem,
	mergeFeed,
} from "../modules/dashboard/feed";

// Kit tests run on a fixed plan catalog (@fuutu/test-utils), not the
// app's PLANS — an app that replaces its catalog keeps them meaningful.
vi.mock("@fuutu/payments/config", async (importOriginal) => ({
	...(await importOriginal<typeof import("@fuutu/payments/config")>()),
	...(await import("@fuutu/test-utils")).planCatalogFixture,
}));

vi.mock("@fuutu/payments/config.server", () => ({
	getPlanIdForProductId: vi.fn().mockReturnValue("pro"),
	getOneTimePlanPriceIds: vi.fn().mockReturnValue([]),
}));

// A mutable copy of the org policy, so a test can model a custom role
// without CREDIT.VIEW / PAYMENT.VIEW / API_KEY.VIEW (the default member
// has them all).
vi.mock("@fuutu/rbac", async (importOriginal) => {
	const real = await importOriginal<typeof import("@fuutu/rbac")>();
	return {
		...real,
		ORG_POLICY: {
			member: [...real.ORG_POLICY.member],
			admin: [...real.ORG_POLICY.admin],
			owner: [...real.ORG_POLICY.owner],
		},
	};
});

vi.mock("@fuutu/db", () => ({
	countOrganizationMembers: vi.fn(),
	countOrganizationsForUser: vi.fn(),
	getActiveSubscriptionForOrganization: vi.fn(),
	getActiveSubscriptionForUser: vi.fn(),
	getActiveOneTimePlanPurchase: vi.fn(),
	countApiKeys: vi.fn(),
	countOrgApiKeys: vi.fn(),
	countWebhooks: vi.fn(),
	findAuditLogsByOrg: vi.fn(),
	listAuditLogs: vi.fn(),
	listAuditLogDates: vi.fn(),
	listInvoicesByOrg: vi.fn(),
	listInvoicesByUser: vi.fn(),
	listOrgApiKeys: vi.fn(),
	listApiKeys: vi.fn(),
	getCreditEventsForOrganization: vi.fn(),
	getCreditEventsForUser: vi.fn(),
	getOrganizationWithMembers: vi.fn(),
}));

vi.mock("@fuutu/credits", () => ({
	getCreditBalanceSummary: vi.fn(),
}));

vi.mock("@fuutu/ai", () => ({ resolveAIProvider: vi.fn() }));

const db = await import("@fuutu/db");
const { getCreditBalanceSummary } = await import("@fuutu/credits");
const { auth } = await import("@fuutu/auth");
const { ORG_POLICY, PERMISSIONS } = await import("@fuutu/rbac");
const { paymentsConfig } = await import("@fuutu/payments/config");
const { dashboardRouter } = await import("../modules/dashboard/router");

const DEFAULT_MEMBER_POLICY = [...ORG_POLICY.member];
const NOW = new Date("2026-11-13T10:00:00Z");
const WINDOW_START = new Date("2026-10-15T00:00:00Z");

const context = makeSession<Context>(makeUser());
const anonymous = makeSession<Context>(null);
const orgKeyContext = {
	...makeSession<Context>(makeUser()),
	apiKey: { id: "key-org", organizationId: "org-1" },
} as Context;

const org = (role: string) => ({
	id: "org-1",
	name: "Acme",
	slug: "acme",
	createdAt: new Date("2024-01-01"),
	members: [
		{ id: "m-1", userId: "user-1", role },
		{ id: "m-2", userId: "user-2", role: "member" },
	],
	invitations: [],
});

const foreignOrg = {
	id: "org-evil",
	name: "Foreign Corp",
	slug: "foreign",
	createdAt: new Date("2024-01-01"),
	members: [{ id: "m-evil", userId: "user-evil", role: "owner" }],
	invitations: [],
};

const orgAuditRows = [
	{
		id: "log-org-1",
		userId: "user-2",
		organizationId: "org-1",
		action: "org.invite",
		ip: "203.0.113.9",
		userAgent: "Mozilla/5.0 SecretAgent",
		metadata: { email: "invitee@example.com" },
		createdAt: new Date("2026-11-13T09:00:00Z"),
		user: { id: "user-2", email: "member@fuutu.local", name: "Member User" },
	},
	{
		id: "log-org-2",
		userId: "user-3",
		organizationId: "org-1",
		action: "auth.session_created",
		ip: "203.0.113.10",
		userAgent: "Mozilla/5.0 SecretAgent",
		metadata: null,
		createdAt: new Date("2026-11-12T09:00:00Z"),
		user: { id: "user-3", email: "admin@fuutu.local", name: "Admin User" },
	},
];

const ownAuditRows = [
	{
		id: "log-own-1",
		userId: "user-1",
		organizationId: null,
		action: "auth.sign_up",
		ip: "198.51.100.7",
		userAgent: "Mozilla/5.0 SecretAgent",
		metadata: null,
		createdAt: new Date("2026-11-11T09:00:00Z"),
		user: { id: "user-1", email: "test@fuutu.local", name: "Test User" },
	},
];

const invoices = [
	{
		id: "inv-1",
		status: "paid",
		amount: 49,
		currency: "USD",
		url: "https://billing.example/secret-url",
		pdfUrl: null,
		providerInvoiceId: "prov_inv_1",
		issuedAt: new Date("2026-11-12T08:00:00Z"),
		paidAt: new Date("2026-11-12T12:00:00Z"),
	},
	{
		id: "inv-2",
		status: "open",
		amount: 149,
		currency: "USD",
		url: null,
		pdfUrl: null,
		providerInvoiceId: "prov_inv_2",
		issuedAt: new Date("2026-11-13T07:00:00Z"),
		paidAt: null,
	},
	{
		id: "inv-3",
		status: "void",
		amount: 49,
		currency: "USD",
		url: null,
		pdfUrl: null,
		providerInvoiceId: "prov_inv_3",
		issuedAt: new Date("2026-11-13T09:30:00Z"),
		paidAt: null,
	},
];

const apiKeys = [
	{
		id: "key-1",
		name: "Acme CI/CD",
		key: "sha256-hash-value",
		prefix: "futu_sk_abcd...",
		userId: "user-1",
		organizationId: "org-1",
		scopes: [],
		lastUsedAt: null,
		expiresAt: null,
		revokedAt: null,
		createdAt: new Date("2026-11-10T09:00:00Z"),
	},
];

const creditEvents = [
	{
		id: "ce-1",
		userId: null,
		organizationId: "org-1",
		meterKey: "ai_tokens",
		amount: 1200,
		source: "recurring",
		reason: "ai_chat_message",
		metadata: { prompt: "secret prompt" },
		createdAt: new Date("2026-11-13T08:30:00Z"),
	},
	{
		id: "ce-2",
		userId: null,
		organizationId: "org-1",
		meterKey: "ai_tokens",
		amount: 500_000,
		source: "admin_grant",
		reason: "subscription_grant",
		metadata: null,
		createdAt: new Date("2026-11-01T00:00:00Z"),
	},
];

const aiSummary = {
	meterKey: "ai_tokens",
	label: "AI Tokens",
	unit: "tokens",
	recurring: {
		granted: 500_000,
		consumed: 20_000,
		remaining: 480_000,
		periodEnd: new Date("2026-12-01T00:00:00Z"),
	},
	topups: { total: 0, consumed: 0, remaining: 0, packageCount: 0 },
	total: 480_000,
};

const overview = (input: { organizationId?: string }, ctx = context) =>
	call(dashboardRouter.overview, input, { context: ctx });

function useOrgRole(role: string) {
	vi.mocked(auth.api.getFullOrganization).mockResolvedValue(org(role) as never);
}

const dataQueries = () => [
	db.countOrganizationMembers,
	db.findAuditLogsByOrg,
	db.listAuditLogs,
	db.listAuditLogDates,
	db.listInvoicesByOrg,
	db.listOrgApiKeys,
	db.countOrgApiKeys,
	db.countWebhooks,
	db.getCreditEventsForOrganization,
	getCreditBalanceSummary,
];

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
	ORG_POLICY.member = [...DEFAULT_MEMBER_POLICY];
	paymentsConfig.creditsEnabled = true;

	vi.mocked(db.countOrganizationMembers).mockResolvedValue(2);
	vi.mocked(db.countOrganizationsForUser).mockResolvedValue(1);
	vi.mocked(db.getActiveSubscriptionForOrganization).mockResolvedValue({
		productId: "prod_pro",
		priceId: "price_pro",
		currentPeriodEnd: new Date("2026-12-01T00:00:00Z"),
	} as never);
	vi.mocked(db.getActiveSubscriptionForUser).mockResolvedValue(null);
	vi.mocked(db.getActiveOneTimePlanPurchase).mockResolvedValue(null);
	vi.mocked(db.countApiKeys).mockResolvedValue(3);
	vi.mocked(db.countOrgApiKeys).mockResolvedValue(1);
	vi.mocked(db.countWebhooks).mockResolvedValue(2);
	vi.mocked(db.findAuditLogsByOrg).mockResolvedValue(orgAuditRows as never);
	vi.mocked(db.listAuditLogs).mockResolvedValue(ownAuditRows as never);
	vi.mocked(db.listAuditLogDates).mockResolvedValue([
		{ action: "org.invite", createdAt: new Date("2026-11-13T09:00:00Z") },
		{
			action: "auth.session_created",
			createdAt: new Date("2026-11-12T09:00:00Z"),
		},
	] as never);
	vi.mocked(db.listInvoicesByOrg).mockResolvedValue(invoices as never);
	vi.mocked(db.listInvoicesByUser).mockResolvedValue([] as never);
	vi.mocked(db.listOrgApiKeys).mockResolvedValue(apiKeys as never);
	vi.mocked(db.listApiKeys).mockResolvedValue([] as never);
	vi.mocked(db.getCreditEventsForOrganization).mockResolvedValue(
		creditEvents as never,
	);
	vi.mocked(db.getCreditEventsForUser).mockResolvedValue([] as never);
	vi.mocked(getCreditBalanceSummary).mockResolvedValue([aiSummary] as never);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("dashboard.overview — access", () => {
	it("is registered on the app router", async () => {
		const { appRouter } = await import("../orpc/router");
		// `.router()` re-wraps procedures, so compare the route, not identity.
		expect(appRouter.dashboard.overview["~orpc"].route).toMatchObject({
			method: "GET",
			path: "/dashboard/overview",
		});
	});

	it("rejects unauthenticated", async () => {
		await expect(overview({}, anonymous)).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("rejects an organizationId the caller is not a member of", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			foreignOrg as never,
		);

		await expect(
			overview({ organizationId: "org-evil" }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		for (const query of dataQueries()) {
			expect(query).not.toHaveBeenCalled();
		}
	});

	it("org member without AUDIT_LOG.VIEW gets their own audit rows, not the org's", async () => {
		useOrgRole("member");

		const result = await overview({ organizationId: "org-1" });

		expect(db.findAuditLogsByOrg).not.toHaveBeenCalled();
		// Own rows in THIS org only — never personal sign-ins or other orgs.
		expect(db.listAuditLogs).toHaveBeenCalledWith({
			userId: "user-1",
			organizationId: "org-1",
			take: 8,
		});
		expect(db.listAuditLogDates).toHaveBeenCalledWith({
			organizationId: "org-1",
			userId: "user-1",
			since: WINDOW_START,
		});
		const ids = result.feed.map((item) => item.id);
		expect(ids).toContain("audit:log-own-1");
		expect(ids).not.toContain("audit:log-org-1");
		expect(ids).not.toContain("audit:log-org-2");
	});

	it("org-scoped API key of a member reads only the member's own rows in that org", async () => {
		vi.mocked(db.getOrganizationWithMembers).mockResolvedValue({
			...org("member"),
			members: [
				{
					id: "m-1",
					userId: "user-1",
					role: "member",
					user: { email: "test@fuutu.local" },
				},
			],
		} as never);

		await overview({ organizationId: "org-1" }, orgKeyContext);

		expect(auth.api.getFullOrganization).not.toHaveBeenCalled();
		expect(db.findAuditLogsByOrg).not.toHaveBeenCalled();
		expect(db.listAuditLogs).toHaveBeenCalledWith({
			userId: "user-1",
			organizationId: "org-1",
			take: 8,
		});
		expect(db.listAuditLogDates).toHaveBeenCalledWith({
			organizationId: "org-1",
			userId: "user-1",
			since: WINDOW_START,
		});
	});

	it("org-scoped API key cannot read the personal scope", async () => {
		await expect(overview({}, orgKeyContext)).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		for (const query of dataQueries()) {
			expect(query).not.toHaveBeenCalled();
		}
		expect(db.listInvoicesByUser).not.toHaveBeenCalled();
		expect(db.listApiKeys).not.toHaveBeenCalled();
	});

	it("org admin with AUDIT_LOG.VIEW gets the org's audit rows", async () => {
		useOrgRole("admin");

		const result = await overview({ organizationId: "org-1" });

		expect(db.listAuditLogs).not.toHaveBeenCalled();
		expect(db.findAuditLogsByOrg).toHaveBeenCalledWith("org-1", { take: 8 });
		expect(db.listAuditLogDates).toHaveBeenCalledWith({
			organizationId: "org-1",
			since: WINDOW_START,
		});
		expect(result.feed.map((item) => item.id)).toContain("audit:log-org-1");
	});

	it("returns credits null when the role lacks CREDIT.VIEW", async () => {
		ORG_POLICY.member = DEFAULT_MEMBER_POLICY.filter(
			(p) => p !== PERMISSIONS.CREDIT.VIEW,
		);
		useOrgRole("member");

		const result = await overview({ organizationId: "org-1" });

		expect(result.credits).toBeNull();
		expect(getCreditBalanceSummary).not.toHaveBeenCalled();
		expect(db.getCreditEventsForOrganization).not.toHaveBeenCalled();
		expect(result.feed.some((item) => item.area === "ai")).toBe(false);
		expect(result.activity.days.every((day) => day.ai === 0)).toBe(true);
	});

	it("returns credits null when credits are disabled", async () => {
		paymentsConfig.creditsEnabled = false;
		useOrgRole("owner");

		const result = await overview({ organizationId: "org-1" });

		expect(result.credits).toBeNull();
		expect(getCreditBalanceSummary).not.toHaveBeenCalled();
		expect(db.getCreditEventsForOrganization).not.toHaveBeenCalled();
	});

	it("returns billing and api null when the role lacks PAYMENT.VIEW and API_KEY.VIEW", async () => {
		ORG_POLICY.member = DEFAULT_MEMBER_POLICY.filter(
			(p) =>
				p !== PERMISSIONS.PAYMENT.VIEW &&
				p !== PERMISSIONS.API_KEY.VIEW &&
				p !== PERMISSIONS.WEBHOOK.VIEW,
		);
		useOrgRole("member");

		const result = await overview({ organizationId: "org-1" });

		expect(result.billing).toBeNull();
		expect(result.api).toBeNull();
		expect(db.listInvoicesByOrg).not.toHaveBeenCalled();
		expect(db.listOrgApiKeys).not.toHaveBeenCalled();
		expect(db.countWebhooks).not.toHaveBeenCalled();
		expect(
			result.feed.some(
				(item) => item.area === "billing" || item.area === "api",
			),
		).toBe(false);
	});

	it("feed items never expose ip, userAgent, metadata, email or key material", async () => {
		useOrgRole("owner");

		const result = await overview({ organizationId: "org-1" });

		const allowed = [
			"id",
			"area",
			"kind",
			"actor",
			"at",
			"amount",
			"currency",
			"label",
		];
		expect(result.feed.length).toBeGreaterThan(0);
		for (const item of result.feed) {
			for (const key of Object.keys(item)) {
				expect(allowed).toContain(key);
			}
		}
		const wire = JSON.stringify(result);
		for (const secret of [
			"203.0.113",
			"198.51.100.7",
			"SecretAgent",
			"invitee@example.com",
			"@fuutu.local",
			"futu_sk_",
			"sha256-hash-value",
			"secret prompt",
			"secret-url",
			"prov_inv_",
		]) {
			expect(wire).not.toContain(secret);
		}
	});
});

describe("dashboard.overview — shape", () => {
	it("returns the organization overview for an owner", async () => {
		useOrgRole("owner");

		const result = await overview({ organizationId: "org-1" });

		expect(db.countOrganizationMembers).toHaveBeenCalledWith("org-1");
		expect(getCreditBalanceSummary).toHaveBeenCalledWith({
			organizationId: "org-1",
		});
		expect(result).toMatchObject({
			scope: "organization",
			planId: "pro",
			users: { kind: "members", count: 2, limit: 50 },
			billing: { planId: "pro", renewsAt: "2026-12-01T00:00:00.000Z" },
			credits: {
				meterKey: "ai_tokens",
				remaining: 480_000,
				granted: 500_000,
				included: 500_000,
			},
			api: {
				apiKeys: 1,
				apiKeyLimit: "unlimited",
				webhooks: 2,
				webhookLimit: 10,
			},
		});
		expect(result.feed).toEqual([
			{
				id: "audit:log-org-1",
				area: "users",
				kind: "org.invite",
				actor: "Member User",
				at: "2026-11-13T09:00:00.000Z",
			},
			{
				id: "credit:ce-1",
				area: "ai",
				kind: "credits.consumed",
				actor: null,
				at: "2026-11-13T08:30:00.000Z",
				amount: 1200,
			},
			{
				id: "invoice:inv-2",
				area: "billing",
				kind: "invoice.open",
				actor: null,
				at: "2026-11-13T07:00:00.000Z",
				amount: 149,
				currency: "USD",
			},
			{
				id: "invoice:inv-1",
				area: "billing",
				kind: "invoice.paid",
				actor: null,
				at: "2026-11-12T12:00:00.000Z",
				amount: 49,
				currency: "USD",
			},
			{
				id: "audit:log-org-2",
				area: "users",
				kind: "auth.session_created",
				actor: "Admin User",
				at: "2026-11-12T09:00:00.000Z",
			},
			{
				id: "api_key:key-1",
				area: "api",
				kind: "api_key.created",
				actor: null,
				at: "2026-11-10T09:00:00.000Z",
				label: "Acme CI/CD",
			},
		]);
		const { days } = result.activity;
		expect(days).toHaveLength(30);
		expect(days[0]?.date).toBe("2026-10-15");
		expect(days[29]).toEqual({
			date: "2026-11-13",
			users: 1,
			billing: 1,
			ai: 1,
			api: 0,
		});
		expect(days[28]).toEqual({
			date: "2026-11-12",
			users: 1,
			billing: 1,
			ai: 0,
			api: 0,
		});
		expect(days[26]).toEqual({
			date: "2026-11-10",
			users: 0,
			billing: 0,
			ai: 0,
			api: 1,
		});
	});

	it("returns the personal overview without an organizationId", async () => {
		const result = await overview({});

		expect(auth.api.getFullOrganization).not.toHaveBeenCalled();
		expect(db.countOrganizationsForUser).toHaveBeenCalledWith("user-1");
		// Personal scope = personal records only, never org invoices/keys
		// the user happened to create.
		expect(db.listInvoicesByUser).toHaveBeenCalledWith(
			"user-1",
			expect.objectContaining({ personalOnly: true }),
		);
		expect(db.listApiKeys).toHaveBeenCalledWith(
			"user-1",
			expect.objectContaining({ personalOnly: true }),
		);
		expect(db.countApiKeys).toHaveBeenCalledWith("user-1", {
			personalOnly: true,
		});
		expect(db.getCreditEventsForUser).toHaveBeenCalledWith(
			"user-1",
			expect.anything(),
		);
		expect(getCreditBalanceSummary).toHaveBeenCalledWith({ userId: "user-1" });
		expect(db.listAuditLogs).toHaveBeenCalledWith({
			userId: "user-1",
			take: 8,
		});
		expect(db.findAuditLogsByOrg).not.toHaveBeenCalled();
		expect(db.countWebhooks).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			scope: "user",
			planId: "free",
			users: { kind: "organizations", count: 1, limit: 1 },
			billing: { planId: "free", renewsAt: null },
			credits: { meterKey: "ai_tokens", included: 10_000 },
			api: {
				apiKeys: 3,
				apiKeyLimit: 2,
				webhooks: null,
				webhookLimit: false,
			},
		});
		expect(result.feed.map((item) => item.id)).toEqual(["audit:log-own-1"]);
		expect(result.activity.days).toHaveLength(30);
	});
});

describe("activity-series", () => {
	it("buckets UTC days, always returns 30 entries, counts per area, ignores rows older than 30 days", () => {
		const days = buildActivitySeries(
			[
				{ area: "users", at: new Date("2026-11-13T00:30:00Z") },
				{ area: "users", at: new Date("2026-11-13T09:59:00Z") },
				{ area: "billing", at: new Date("2026-11-13T05:00:00Z") },
				{ area: "ai", at: new Date("2026-11-12T23:59:59Z") },
				{ area: "api", at: new Date("2026-10-15T00:00:00Z") },
				{ area: "api", at: new Date("2026-10-14T23:59:59Z") },
				{ area: "users", at: new Date("2026-09-01T12:00:00Z") },
			],
			NOW,
		);

		expect(days).toHaveLength(30);
		expect(days[0]).toEqual({
			date: "2026-10-15",
			users: 0,
			billing: 0,
			ai: 0,
			api: 1,
		});
		expect(days[28]).toEqual({
			date: "2026-11-12",
			users: 0,
			billing: 0,
			ai: 1,
			api: 0,
		});
		expect(days[29]).toEqual({
			date: "2026-11-13",
			users: 2,
			billing: 1,
			ai: 0,
			api: 0,
		});
		const total = days.reduce(
			(sum, d) => sum + d.users + d.billing + d.ai + d.api,
			0,
		);
		expect(total).toBe(5);
	});

	it("returns 30 empty days for no events", () => {
		const days = buildActivitySeries([], NOW);
		expect(days).toHaveLength(30);
		expect(days[1]?.date).toBe("2026-10-16");
		expect(days.every((d) => d.users + d.billing + d.ai + d.api === 0)).toBe(
			true,
		);
	});
});

describe("feed", () => {
	const item = (id: string, at: string): FeedItem => ({
		id,
		area: "users",
		kind: "audit.other",
		actor: null,
		at,
	});

	it("merges sources newest first and caps at 8", () => {
		const merged = mergeFeed([
			[
				item("a1", "2026-11-13T09:00:00.000Z"),
				item("a2", "2026-11-11T09:00:00.000Z"),
				item("a3", "2026-11-05T09:00:00.000Z"),
			],
			[
				item("b1", "2026-11-12T09:00:00.000Z"),
				item("b2", "2026-11-04T09:00:00.000Z"),
				item("b3", "2026-11-01T09:00:00.000Z"),
			],
			[
				item("c1", "2026-11-13T10:00:00.000Z"),
				item("c2", "2026-11-06T09:00:00.000Z"),
				item("c3", "2026-11-02T09:00:00.000Z"),
			],
		]);

		expect(merged.map((i) => i.id)).toEqual([
			"c1",
			"a1",
			"b1",
			"a2",
			"c2",
			"a3",
			"b2",
			"c3",
		]);
	});

	it("maps audit actions to areas", () => {
		expect(areaForAuditAction("auth.session_created")).toBe("users");
		expect(areaForAuditAction("org.invite.accept")).toBe("users");
		expect(areaForAuditAction("user.update")).toBe("users");
		expect(areaForAuditAction("role.change")).toBe("users");
		expect(areaForAuditAction("payment.refund")).toBe("billing");
		expect(areaForAuditAction("subscription.created")).toBe("billing");
		expect(areaForAuditAction("invoice.paid")).toBe("billing");
		expect(areaForAuditAction("credits.grant")).toBe("ai");
		expect(areaForAuditAction("ai.prompt")).toBe("ai");
		expect(areaForAuditAction("chat.message")).toBe("ai");
		expect(areaForAuditAction("api_key.create")).toBe("api");
		expect(areaForAuditAction("webhook.delivery")).toBe("api");
		expect(areaForAuditAction("mcp.tool_call")).toBe("api");
		expect(areaForAuditAction("something.else")).toBe("users");
		expect(areaForAuditAction("paymentless")).toBe("users");
	});
});
