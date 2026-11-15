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

// Platform-group extras live in their own app-owned file.
const mainExtras = vi.hoisted(() => ({
	appMainNavItems: [] as unknown[],
}));
vi.mock("../../../../apps/saas/src/app-main-nav", () => mainExtras);

// Kit demo flags, fixed: an app that switches the demo modules off keeps
// these tests meaningful.
const flags = vi.hoisted(() => ({ aiChat: true, crm: true, webhooks: true }));
vi.mock("@fuutu/config", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@fuutu/config")>();
	return {
		...actual,
		config: {
			...actual.config,
			features: new Proxy(actual.config.features, {
				get: (target, prop, receiver) =>
					prop in flags
						? flags[prop as keyof typeof flags]
						: Reflect.get(target, prop, receiver),
			}),
		},
	};
});

const nav = await import(
	"../../../../apps/saas/src/modules/app/components/nav-config"
);
const { buildBreadcrumbs } = await import(
	"../../../../apps/saas/src/modules/app/components/breadcrumbs"
);

const keys = (items: { titleKey: string }[]) => items.map((i) => i.titleKey);

beforeEach(() => {
	flags.aiChat = true;
	flags.crm = true;
	flags.webhooks = true;
	mainExtras.appMainNavItems = [];
	extras.appOrgSettingsNavItems = [];
	extras.appAccountNavItems = [];
	extras.appAdminNavItems = [];
	extras.appBreadcrumbLabels = {};
});

/** Stand-in for a lucide icon component. */
const Icon = () => null;
const urls = (items: { url: string }[]) => items.map((i) => i.url);

describe("main nav (Platform group)", () => {
	it("keeps the kit list when there are no extras", () => {
		expect(keys(nav.getMainItems(null))).toEqual([
			"dashboard",
			"aiChat",
			"crm",
			"notifications",
		]);
		expect(urls(nav.getMainItems(null))).toEqual([
			"/dashboard",
			"/chat",
			"/crm",
			"/notifications",
		]);
		expect(urls(nav.getMainItems("acme"))).toEqual([
			"/organizations/acme/dashboard",
			"/organizations/acme/chat",
			"/organizations/acme/crm",
			"/notifications",
		]);
	});

	it("drops the demo modules whose flag is off; an anchor on them appends", () => {
		flags.aiChat = false;
		flags.crm = false;
		mainExtras.appMainNavItems = [
			{ titleKey: "agents", icon: Icon, segment: "agents", after: "crm" },
		];
		expect(keys(nav.getMainItems(null))).toEqual([
			"dashboard",
			"notifications",
			"agents",
		]);
	});

	it("an org-segment item resolves under the current org and is hidden outside org routes", () => {
		mainExtras.appMainNavItems = [
			{
				titleKey: "agents",
				icon: Icon,
				orgSegment: "agents",
				after: "dashboard",
			},
		];
		const inOrg = nav.getMainItems("acme");
		expect(keys(inOrg).slice(0, 2)).toEqual(["dashboard", "agents"]);
		expect(inOrg[1]?.url).toBe("/organizations/acme/agents");
		expect(keys(nav.getMainItems(null))).not.toContain("agents");
	});

	it("a segment item is scoped like the kit items, an href item is absolute", () => {
		mainExtras.appMainNavItems = [
			{ titleKey: "reports", icon: Icon, segment: "reports" },
			{ titleKey: "releases", icon: Icon, href: "/releases", after: "crm" },
		];
		expect(urls(nav.getMainItems(null))).toEqual([
			"/dashboard",
			"/chat",
			"/crm",
			"/releases",
			"/notifications",
			"/reports",
		]);
		const inOrg = nav.getMainItems("acme");
		expect(inOrg.find((i) => i.titleKey === "reports")?.url).toBe(
			"/organizations/acme/reports",
		);
		expect(inOrg.find((i) => i.titleKey === "releases")?.url).toBe("/releases");
	});

	it("hides an item whose feature gate is off", () => {
		mainExtras.appMainNavItems = [
			{ titleKey: "agents", icon: Icon, segment: "agents", enabled: false },
		];
		expect(keys(nav.getMainItems("acme"))).not.toContain("agents");
	});

	it("shows a permission-gated item only inside an org whose role allows it", () => {
		mainExtras.appMainNavItems = [
			{
				titleKey: "agents",
				icon: Icon,
				segment: "agents",
				permission: "update:organization",
			},
		];
		const can = vi.fn(() => true);
		expect(keys(nav.getMainItems("acme", can))).toContain("agents");
		expect(can).toHaveBeenCalledWith("update:organization");
		expect(keys(nav.getMainItems("acme", () => false))).not.toContain("agents");
		expect(keys(nav.getMainItems("acme"))).not.toContain("agents");
		// Outside an org there is no role to check — fail closed.
		expect(keys(nav.getMainItems(null, can))).not.toContain("agents");
	});

	it("renders only the item fields (icon included), no extension-only ones", () => {
		mainExtras.appMainNavItems = [
			{
				titleKey: "agents",
				icon: Icon,
				orgSegment: "agents",
				after: "dashboard",
				exact: true,
			},
		];
		expect(nav.getMainItems("acme")[1]).toEqual({
			titleKey: "agents",
			url: "/organizations/acme/agents",
			icon: Icon,
			exact: true,
		});
	});

	it("throws on a key the kit already uses", () => {
		mainExtras.appMainNavItems = [
			{ titleKey: "crm", icon: Icon, segment: "x" },
		];
		expect(() => nav.getMainItems(null)).toThrow(/duplicate key "crm"/);
	});
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

describe("org settings — replaces", () => {
	const kitWith = (replacement: string) =>
		keys(nav.getOrgSettingsItems("acme", true)).map((key) =>
			key === "apiKeys" ? replacement : key,
		);

	it("swaps the kit item in place", () => {
		const expected = kitWith("keys");
		extras.appOrgSettingsNavItems = [
			{ titleKey: "keys", segment: "keys", replaces: "apiKeys" },
		];
		const items = nav.getOrgSettingsItems("acme", true);
		expect(keys(items)).toEqual(expected);
		expect(items.find((i) => i.titleKey === "keys")?.href).toBe(
			"/organizations/acme/settings/keys",
		);
	});

	it("wins over after", () => {
		const expected = kitWith("keys");
		extras.appOrgSettingsNavItems = [
			{
				titleKey: "keys",
				segment: "keys",
				replaces: "apiKeys",
				after: "general",
			},
		];
		expect(keys(nav.getOrgSettingsItems("acme", true))).toEqual(expected);
	});

	it("an item anchored on the replaced key lands after the replacement", () => {
		extras.appOrgSettingsNavItems = [
			{ titleKey: "keys", segment: "keys", replaces: "apiKeys" },
			{ titleKey: "usage", segment: "usage", after: "apiKeys" },
		];
		const k = keys(nav.getOrgSettingsItems("acme", true));
		expect(k[k.indexOf("keys") + 1]).toBe("usage");
	});

	it("two items replacing one kit key throw", () => {
		extras.appOrgSettingsNavItems = [
			{ titleKey: "keys", segment: "keys", replaces: "apiKeys" },
			{ titleKey: "tokens", segment: "tokens", replaces: "apiKeys" },
		];
		expect(() => nav.getOrgSettingsItems("acme", true)).toThrow(/apiKeys/);
	});

	it("replacing a hidden kit item appends", () => {
		flags.webhooks = false;
		extras.appOrgSettingsNavItems = [
			{ titleKey: "hooks", segment: "hooks", replaces: "webhooks" },
		];
		expect(keys(nav.getOrgSettingsItems("acme", true)).at(-1)).toBe("hooks");
	});

	it("replacing a kit item hidden by role drops a replacement without its own permission", () => {
		extras.appOrgSettingsNavItems = [
			{ titleKey: "activity", segment: "activity", replaces: "auditLog" },
		];
		const k = keys(nav.getOrgSettingsItems("acme", false, () => true));
		expect(k).not.toContain("auditLog");
		expect(k).not.toContain("activity");
	});

	it("replacing a kit item hidden by role appends a replacement with its own permission", () => {
		extras.appOrgSettingsNavItems = [
			{
				titleKey: "activity",
				segment: "activity",
				replaces: "auditLog",
				permission: "view:activity",
			},
		];
		expect(
			keys(nav.getOrgSettingsItems("acme", false, () => true)).at(-1),
		).toBe("activity");
		expect(
			keys(nav.getOrgSettingsItems("acme", false, () => false)),
		).not.toContain("activity");
	});

	it("a disabled replacement keeps the kit item", () => {
		extras.appOrgSettingsNavItems = [
			{
				titleKey: "keys",
				segment: "keys",
				replaces: "apiKeys",
				enabled: false,
			},
		];
		const k = keys(nav.getOrgSettingsItems("acme", true));
		expect(k).toContain("apiKeys");
		expect(k).not.toContain("keys");
	});

	it("a replacement the role may not see still removes the kit item", () => {
		extras.appOrgSettingsNavItems = [
			{
				titleKey: "keys",
				segment: "keys",
				replaces: "apiKeys",
				permission: "update:organization",
			},
		];
		const k = keys(nav.getOrgSettingsItems("acme", true, () => false));
		expect(k).not.toContain("apiKeys");
		expect(k).not.toContain("keys");
	});
});

describe("org settings — webhooks flag", () => {
	it("org settings show Webhooks while the flag is on", () => {
		const items = nav.getOrgSettingsItems("acme", true);
		expect(keys(items)).toContain("webhooks");
		expect(items.find((i) => i.titleKey === "webhooks")?.href).toBe(
			"/organizations/acme/settings/webhooks",
		);
	});

	it("org settings hide Webhooks when the flag is off", () => {
		flags.webhooks = false;
		const k = keys(nav.getOrgSettingsItems("acme", true));
		expect(k).not.toContain("webhooks");
		expect(k.at(-1)).toBe("danger");
	});

	it("an app item anchored after webhooks is appended while the flag is off", () => {
		extras.appOrgSettingsNavItems = [
			{ titleKey: "usage", segment: "usage", after: "webhooks" },
		];
		const on = keys(nav.getOrgSettingsItems("acme", true));
		expect(on[on.indexOf("webhooks") + 1]).toBe("usage");
		flags.webhooks = false;
		expect(keys(nav.getOrgSettingsItems("acme", true)).at(-1)).toBe("usage");
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
			"adminOrganizations",
			"adminAuditLogs",
			"adminSystem",
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
			"adminOrganizations",
			"adminAuditLogs",
			"adminSystem",
		]);
	});

	it("returns the kit admin list without extras — no overview self-link", () => {
		expect(nav.getAdminItems()).toEqual([
			{ titleKey: "adminUsers", href: "/admin/users" },
			{ titleKey: "adminOrganizations", href: "/admin/organizations" },
			{ titleKey: "adminAuditLogs", href: "/admin/audit-logs" },
			{ titleKey: "adminSystem", href: "/admin/system" },
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

	it("labels the admin organization routes", () => {
		expect(buildBreadcrumbs("/admin/organizations", null)).toEqual([
			{ labelKey: "breadcrumb.admin", href: "/admin/users" },
			{ labelKey: "breadcrumb.organizations", href: "/admin/organizations" },
		]);
		expect(buildBreadcrumbs("/admin/organizations/org-1", null)).toEqual([
			{ labelKey: "breadcrumb.admin", href: "/admin/users" },
			{ labelKey: "breadcrumb.organizations", href: "/admin/organizations" },
			{ labelKey: "breadcrumb.orgDetail", href: "/admin/organizations/org-1" },
		]);
		expect(buildBreadcrumbs("/admin/system", null).at(-1)).toEqual({
			labelKey: "breadcrumb.system",
			href: "/admin/system",
		});
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

describe("the shipped app lists (apps/saas/src/app-navigation.ts, app-main-nav.ts)", () => {
	// A colliding key throws while the sidebar renders — every app page
	// would fail. This catches it in CI instead, incl. gated-off items.
	const KIT_KEYS = {
		appMainNavItems: ["dashboard", "aiChat", "crm", "notifications"],
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
		appAdminNavItems: [
			"adminUsers",
			"adminOrganizations",
			"adminAuditLogs",
			"adminSystem",
		],
	} as const;

	const loadShipped = async () => ({
		...(await vi.importActual<
			typeof import("../../../../apps/saas/src/app-navigation")
		>("../../../../apps/saas/src/app-navigation")),
		...(await vi.importActual<
			typeof import("../../../../apps/saas/src/app-main-nav")
		>("../../../../apps/saas/src/app-main-nav")),
	});

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
		expect(keys(nav.getMainItems("acme"))).toEqual(KIT_KEYS.appMainNavItems);
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
		mainExtras.appMainNavItems = [...shipped.appMainNavItems];
		extras.appOrgSettingsNavItems = [...shipped.appOrgSettingsNavItems];
		extras.appAccountNavItems = [...shipped.appAccountNavItems];
		extras.appAdminNavItems = [...shipped.appAdminNavItems];
		expect(() => nav.getMainItems("acme", () => true)).not.toThrow();
		expect(() =>
			nav.getOrgSettingsItems("acme", true, () => true),
		).not.toThrow();
		expect(() => nav.getAccountItems()).not.toThrow();
		expect(() => nav.getAdminItems()).not.toThrow();
	});
});
