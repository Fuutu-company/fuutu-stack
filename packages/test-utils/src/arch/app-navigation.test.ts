import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * App-owned sidebar + breadcrumb extensions (`apps/saas/src/app-navigation.ts`)
 * merged by the kit's nav-config / breadcrumbs. The app file is mocked so
 * each test controls the extras; empty extras must reproduce the kit lists.
 */

const extras = vi.hoisted(() => ({
	appOrgSettingsNavItems: [] as unknown[],
	appAccountNavItems: [] as unknown[],
	appAdminNavItems: [] as unknown[],
	appBreadcrumbLabels: {} as Record<string, string>,
}));

vi.mock("../../../../apps/saas/src/app-navigation", () => extras);

const nav = await import(
	"../../../../apps/saas/src/modules/app/components/nav-config"
);
const { buildBreadcrumbs } = await import(
	"../../../../apps/saas/src/modules/app/components/breadcrumbs"
);

const keys = (items: { titleKey: string }[]) => items.map((i) => i.titleKey);

beforeEach(() => {
	extras.appOrgSettingsNavItems = [];
	extras.appAccountNavItems = [];
	extras.appAdminNavItems = [];
	extras.appBreadcrumbLabels = {};
});

describe("org settings extras", () => {
	it("places an item after its anchor with an href under the org settings base", () => {
		extras.appOrgSettingsNavItems = [
			{ titleKey: "projects", segment: "projects", after: "members" },
		];
		const items = nav.getOrgSettingsItems("acme", true);
		const k = keys(items);
		expect(k.slice(0, 3)).toEqual(["general", "members", "projects"]);
		expect(items[2]?.href).toBe("/organizations/acme/settings/projects");
	});

	it("appends an item without an anchor at the end", () => {
		extras.appOrgSettingsNavItems = [{ titleKey: "usage", segment: "usage" }];
		expect(keys(nav.getOrgSettingsItems("acme", true)).at(-1)).toBe("usage");
	});

	it("hides a permission-gated item unless the role check allows it", () => {
		extras.appOrgSettingsNavItems = [
			{
				titleKey: "projects",
				segment: "projects",
				permission: "update:organization",
			},
		];
		expect(keys(nav.getOrgSettingsItems("acme", true))).not.toContain(
			"projects",
		);
		expect(
			keys(nav.getOrgSettingsItems("acme", true, () => false)),
		).not.toContain("projects");
		const can = vi.fn(() => true);
		expect(keys(nav.getOrgSettingsItems("acme", true, can))).toContain(
			"projects",
		);
		expect(can).toHaveBeenCalledWith("update:organization");
	});

	it("hides an item whose feature gate is off", () => {
		extras.appOrgSettingsNavItems = [
			{ titleKey: "projects", segment: "projects", enabled: false },
		];
		expect(keys(nav.getOrgSettingsItems("acme", true))).not.toContain(
			"projects",
		);
	});

	it("keeps the kit list when there are no extras", () => {
		expect(keys(nav.getOrgSettingsItems("acme", false))).not.toContain(
			"auditLog",
		);
		expect(keys(nav.getOrgSettingsItems("acme", true)).slice(0, 2)).toEqual([
			"general",
			"members",
		]);
		expect(keys(nav.getOrgSettingsItems("acme", true)).at(-1)).toBe("danger");
	});
});

describe("account + admin extras", () => {
	it("places an account item after its anchor", () => {
		extras.appAccountNavItems = [
			{
				titleKey: "integrations",
				href: "/settings/integrations",
				after: "security",
			},
		];
		const items = nav.getAccountItems();
		const k = keys(items);
		expect(k.slice(0, 3)).toEqual(["profile", "security", "integrations"]);
		expect(items[2]?.href).toBe("/settings/integrations");
	});

	it("drops an account item whose feature gate is off", () => {
		extras.appAccountNavItems = [
			{
				titleKey: "integrations",
				href: "/settings/integrations",
				enabled: false,
			},
		];
		expect(keys(nav.getAccountItems())).not.toContain("integrations");
	});

	it("places an admin item after its anchor", () => {
		extras.appAdminNavItems = [
			{ titleKey: "adminTenants", href: "/admin/tenants", after: "adminUsers" },
		];
		expect(keys(nav.getAdminItems())).toEqual([
			"adminUsers",
			"adminTenants",
			"adminAuditLogs",
		]);
	});

	it('resolves the deprecated "adminOverview" anchor to the first admin item', () => {
		extras.appAdminNavItems = [
			{
				titleKey: "adminTenants",
				href: "/admin/tenants",
				after: "adminOverview",
			},
			{ titleKey: "adminPlans", href: "/admin/plans", after: "adminOverview" },
		];
		expect(keys(nav.getAdminItems())).toEqual([
			"adminUsers",
			"adminTenants",
			"adminPlans",
			"adminAuditLogs",
		]);
	});

	it("returns the kit admin list without extras — no overview self-link", () => {
		expect(nav.getAdminItems()).toEqual([
			{ titleKey: "adminUsers", href: "/admin/users" },
			{ titleKey: "adminAuditLogs", href: "/admin/audit-logs" },
		]);
	});

	it("does not leak extension-only fields into the rendered item", () => {
		extras.appAdminNavItems = [
			{ titleKey: "adminTenants", href: "/admin/tenants", after: "adminUsers" },
		];
		expect(nav.getAdminItems()[1]).toEqual({
			titleKey: "adminTenants",
			href: "/admin/tenants",
		});
	});
});

describe("no overview items", () => {
	// A group's trigger is not a page: no item links to the group root itself.
	it("no group lists a self-link to its own root path", () => {
		const groups = [
			{
				root: "/organizations/acme/settings",
				items: nav.getOrgSettingsItems("acme", true, () => true),
			},
			{ root: nav.ACCOUNT_SETTINGS_PATH, items: nav.getAccountItems() },
			{ root: nav.ADMIN_PATH, items: nav.getAdminItems() },
		];
		for (const { root, items } of groups) {
			for (const item of items) {
				expect(item.href, item.titleKey).not.toBe(root);
				expect(item.titleKey, item.titleKey).not.toMatch(/overview/i);
			}
		}
	});

	it("the admin home is the first admin item", () => {
		expect(nav.ADMIN_HOME).toBe("/admin/users");
		expect(nav.getAdminItems()[0]?.href).toBe(nav.ADMIN_HOME);
	});
});

describe("plain sub-items", () => {
	// Sub-items render identically: no item carries an area (no marker dot).
	it("no kit item in any group carries an area", () => {
		const all = [
			...nav.getOrgSettingsItems("acme", true, () => true),
			...nav.getAccountItems(),
			...nav.getAdminItems(),
		];
		expect(all.length).toBeGreaterThan(8);
		for (const item of all) {
			expect(item, item.titleKey).not.toHaveProperty("area");
		}
	});
});

describe("breadcrumb extras", () => {
	it("labels the kit routes as before", () => {
		expect(
			buildBreadcrumbs("/organizations/acme/settings/members", null),
		).toEqual([
			{ labelKey: "breadcrumb.organizations", href: "/organizations" },
			{ labelKey: null, label: "Acme", href: "/organizations/acme/dashboard" },
			{ labelKey: "breadcrumb.settings", href: "/organizations/acme/settings" },
			{
				labelKey: "breadcrumb.members",
				href: "/organizations/acme/settings/members",
			},
		]);
		expect(buildBreadcrumbs("/settings", "security")).toEqual([
			{ labelKey: "breadcrumb.settings", href: "/settings" },
			{ labelKey: "breadcrumb.security" },
		]);
	});

	it("the Admin crumb links to the admin home, not the bare group root", () => {
		expect(buildBreadcrumbs("/admin/audit-logs", null)).toEqual([
			{ labelKey: "breadcrumb.admin", href: "/admin/users" },
			{ labelKey: "breadcrumb.auditLogs", href: "/admin/audit-logs" },
		]);
	});

	it("skips segments nobody labels", () => {
		expect(buildBreadcrumbs("/projects/123", null)).toEqual([]);
	});

	it("labels app segments anywhere in the path", () => {
		extras.appBreadcrumbLabels = { projects: "breadcrumb.projects" };
		expect(buildBreadcrumbs("/projects", null)).toEqual([
			{ labelKey: "breadcrumb.projects", href: "/projects" },
		]);
		expect(
			buildBreadcrumbs("/organizations/acme/settings/projects", null).at(-1),
		).toEqual({
			labelKey: "breadcrumb.projects",
			href: "/organizations/acme/settings/projects",
		});
	});

	it("skips an app segment mapped to an empty label instead of an empty crumb", () => {
		extras.appBreadcrumbLabels = { projects: "" };
		expect(buildBreadcrumbs("/projects", null)).toEqual([]);
	});

	it("ignores inherited object keys as segments", () => {
		expect(buildBreadcrumbs("/constructor", null)).toEqual([]);
	});

	it("never overrides a kit label", () => {
		extras.appBreadcrumbLabels = { members: "breadcrumb.team" };
		expect(
			buildBreadcrumbs("/organizations/acme/settings/members", null).at(-1)
				?.labelKey,
		).toBe("breadcrumb.members");
	});
});

describe("the shipped app lists (apps/saas/src/app-navigation.ts)", () => {
	// A colliding key throws while the sidebar renders — every app page
	// would fail. This catches it in CI instead, incl. gated-off items.
	const KIT_KEYS = {
		appOrgSettingsNavItems: [
			"general",
			"members",
			"billing",
			"credits",
			"apiKeys",
			"webhooks",
			"auditLog",
			"danger",
		],
		appAccountNavItems: [
			"profile",
			"security",
			"sessions",
			"billing",
			"credits",
			"apiKeys",
			"danger",
		],
		appAdminNavItems: ["adminUsers", "adminAuditLogs"],
	} as const;

	const loadShipped = () =>
		vi.importActual<typeof import("../../../../apps/saas/src/app-navigation")>(
			"../../../../apps/saas/src/app-navigation",
		);

	for (const group of Object.keys(KIT_KEYS) as (keyof typeof KIT_KEYS)[]) {
		it(`${group} uses unique keys that no kit item uses`, async () => {
			const items = (await loadShipped())[group] as readonly {
				titleKey: string;
			}[];
			const appKeys = items.map((item) => item.titleKey);
			expect(new Set(appKeys).size, group).toBe(appKeys.length);
			const kitKeys: readonly string[] = KIT_KEYS[group];
			expect(
				appKeys.filter((key) => kitKeys.includes(key)),
				group,
			).toEqual([]);
		});
	}

	it("the kit key lists above cover every item nav-config renders", () => {
		for (const key of keys(nav.getOrgSettingsItems("acme", true))) {
			expect(KIT_KEYS.appOrgSettingsNavItems).toContain(key);
		}
		for (const key of keys(nav.getAccountItems())) {
			expect(KIT_KEYS.appAccountNavItems).toContain(key);
		}
		expect(keys(nav.getAdminItems())).toEqual(KIT_KEYS.appAdminNavItems);
	});

	it("renders every group with the shipped lists", async () => {
		const shipped = await loadShipped();
		extras.appOrgSettingsNavItems = [...shipped.appOrgSettingsNavItems];
		extras.appAccountNavItems = [...shipped.appAccountNavItems];
		extras.appAdminNavItems = [...shipped.appAdminNavItems];
		expect(() =>
			nav.getOrgSettingsItems("acme", true, () => true),
		).not.toThrow();
		expect(() => nav.getAccountItems()).not.toThrow();
		expect(() => nav.getAdminItems()).not.toThrow();
	});
});
