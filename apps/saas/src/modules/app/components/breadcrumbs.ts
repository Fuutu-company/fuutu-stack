import { appBreadcrumbLabels } from "../../../app-navigation";

export interface BreadcrumbSegment {
	/** i18n key under navigation.breadcrumb.*, or null for dynamic labels */
	labelKey: string | null;
	/** Raw label for dynamic segments (e.g. org slug) */
	label?: string;
	href?: string;
}

/** Own entries only — `constructor` & co. must not match as a segment. */
function lookup(
	map: Readonly<Record<string, string>>,
	key: string,
): string | undefined {
	return Object.hasOwn(map, key) ? map[key] : undefined;
}

function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

const routeMap: Record<string, string> = {
	dashboard: "breadcrumb.dashboard",
	settings: "breadcrumb.settings",
	organizations: "breadcrumb.organizations",
	admin: "breadcrumb.admin",
	chat: "breadcrumb.chat",
	crm: "breadcrumb.crm",
	onboarding: "breadcrumb.onboarding",
	"choose-plan": "breadcrumb.choosePlan",
	notifications: "breadcrumb.notifications",
};

const adminSubRoutes: Record<string, string> = {
	users: "breadcrumb.users",
	"audit-logs": "breadcrumb.auditLogs",
};

const settingsTabMap: Record<string, string> = {
	profile: "breadcrumb.profile",
	security: "breadcrumb.security",
	sessions: "breadcrumb.sessions",
	danger: "breadcrumb.danger",
	billing: "breadcrumb.billing",
	credits: "breadcrumb.credits",
};

const settingsSubRoutes: Record<string, string> = {
	"api-keys": "breadcrumb.apiKeys",
	billing: "breadcrumb.billing",
	credits: "breadcrumb.credits",
};

const orgSettingsSubRoutes: Record<string, string> = {
	general: "breadcrumb.general",
	members: "breadcrumb.members",
	billing: "breadcrumb.billing",
	credits: "breadcrumb.credits",
	danger: "breadcrumb.danger",
	"api-keys": "breadcrumb.apiKeys",
	webhooks: "breadcrumb.webhooks",
	"audit-log": "breadcrumb.auditLog",
};

/**
 * Breadcrumb trail for a SaaS path. Kit segments are labelled by the maps
 * above. App labels (`appBreadcrumbLabels`, `app-navigation.ts`) apply to
 * segments the kit leaves unlabelled only — never to a kit segment.
 * Segments nobody labels (ids), or labelled with an empty key, are skipped.
 */
export function buildBreadcrumbs(
	pathname: string,
	tab: string | null,
): BreadcrumbSegment[] {
	const segments = pathname.split("/").filter(Boolean);
	const crumbs: BreadcrumbSegment[] = [];

	// Check if we're in an org route: /organizations/[slug]/...
	const orgSlugIndex = segments.indexOf("organizations");
	const inOrgRoute = orgSlugIndex !== -1 && orgSlugIndex + 1 < segments.length;

	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i] ?? "";
		const key = lookup(routeMap, segment);
		const adminLabel = lookup(adminSubRoutes, segment);
		const orgSettingsLabel = lookup(orgSettingsSubRoutes, segment);
		const settingsLabel = lookup(settingsSubRoutes, segment);
		const appLabel = lookup(appBreadcrumbLabels, segment);
		const href = `/${segments.slice(0, i + 1).join("/")}`;

		if (key) {
			crumbs.push({ labelKey: key, href });
		} else if (segments[0] === "admin" && adminLabel) {
			crumbs.push({ labelKey: adminLabel, href });
		} else if (inOrgRoute && i === orgSlugIndex + 1) {
			// Dynamic org slug
			crumbs.push({
				labelKey: null,
				label: capitalize(segment),
				href: `/organizations/${segment}/dashboard`,
			});
		} else if (inOrgRoute && orgSettingsLabel) {
			crumbs.push({ labelKey: orgSettingsLabel, href });
		} else if (inOrgRoute && segment === "invoices") {
			crumbs.push({ labelKey: "breadcrumb.invoices", href });
		} else if (!inOrgRoute && segments.includes("settings") && settingsLabel) {
			crumbs.push({ labelKey: settingsLabel, href });
		} else if (appLabel) {
			crumbs.push({ labelKey: appLabel, href });
		}
	}

	// Add tab suffix for personal settings (still tab-based)
	if (tab) {
		const tabLabel = lookup(settingsTabMap, tab);
		if (segments.includes("settings") && tabLabel) {
			crumbs.push({ labelKey: tabLabel });
		}
	}

	return crumbs;
}
