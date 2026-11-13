import { paymentsConfig } from "@fuutu/payments/config";

export interface NavSubItem {
	titleKey: string;
	/** Path, optionally with a `?tab=` query for the tabbed account page. */
	href: string;
	/** Match the path exactly instead of as a prefix. */
	exact?: boolean;
	/** Active when the `tab` query is absent (account page default tab). */
	isDefaultTab?: boolean;
}

export const ACCOUNT_SETTINGS_PATH = "/settings";
export const ADMIN_PATH = "/admin";

export function orgSettingsBase(slug: string): string {
	return `/organizations/${slug}/settings`;
}

export function orgBillingHref(slug: string): string {
	return `${orgSettingsBase(slug)}/billing`;
}

export function getOrgSettingsItems(
	slug: string,
	canViewAuditLog: boolean,
): NavSubItem[] {
	const base = orgSettingsBase(slug);
	const items: NavSubItem[] = [
		{ titleKey: "general", href: `${base}/general` },
		{ titleKey: "members", href: `${base}/members` },
	];
	if (paymentsConfig.billingAttachedTo === "organization") {
		items.push({ titleKey: "billing", href: `${base}/billing` });
	}
	if (paymentsConfig.creditsEnabled) {
		items.push({ titleKey: "credits", href: `${base}/credits` });
	}
	items.push(
		{ titleKey: "apiKeys", href: `${base}/api-keys` },
		{ titleKey: "webhooks", href: `${base}/webhooks` },
	);
	// Audit log requires AUDIT_LOG.VIEW (admin+) — hide rather than link to a
	// redirect dead-end for plain members.
	if (canViewAuditLog) {
		items.push({ titleKey: "auditLog", href: `${base}/audit-log` });
	}
	items.push({ titleKey: "danger", href: `${base}/danger` });
	return items;
}

export function getAccountItems(): NavSubItem[] {
	const items: NavSubItem[] = [
		{
			titleKey: "profile",
			href: `${ACCOUNT_SETTINGS_PATH}?tab=profile`,
			isDefaultTab: true,
		},
		{ titleKey: "security", href: `${ACCOUNT_SETTINGS_PATH}?tab=security` },
		{ titleKey: "sessions", href: `${ACCOUNT_SETTINGS_PATH}?tab=sessions` },
	];
	if (paymentsConfig.billingAttachedTo === "user") {
		items.push({
			titleKey: "billing",
			href: `${ACCOUNT_SETTINGS_PATH}?tab=billing`,
		});
	}
	if (paymentsConfig.creditsEnabled) {
		items.push({
			titleKey: "credits",
			href: `${ACCOUNT_SETTINGS_PATH}?tab=credits`,
		});
	}
	items.push(
		{ titleKey: "apiKeys", href: `${ACCOUNT_SETTINGS_PATH}/api-keys` },
		{ titleKey: "danger", href: `${ACCOUNT_SETTINGS_PATH}?tab=danger` },
	);
	return items;
}

export function getAdminItems(): NavSubItem[] {
	return [
		{ titleKey: "adminOverview", href: ADMIN_PATH, exact: true },
		{ titleKey: "adminUsers", href: `${ADMIN_PATH}/users` },
		{ titleKey: "adminAuditLogs", href: `${ADMIN_PATH}/audit-logs` },
	];
}

export function isPathWithin(pathname: string, prefix: string): boolean {
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isNavItemActive(
	item: NavSubItem,
	pathname: string,
	tab: string | null,
): boolean {
	const [path, query] = item.href.split("?");
	if (!path) return false;
	if (query) {
		const itemTab = new URLSearchParams(query).get("tab");
		const currentTab = tab ?? (item.isDefaultTab ? itemTab : null);
		return pathname === path && currentTab === itemTab;
	}
	return item.exact ? pathname === path : isPathWithin(pathname, path);
}
