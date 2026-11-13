import { paymentsConfig } from "@fuutu/payments/config";
import type { KnownPermission } from "@fuutu/rbac";
import { insertAfter } from "@fuutu/utils/insert-after";
import {
	appAccountNavItems,
	appAdminNavItems,
	appOrgSettingsNavItems,
} from "../../../app-navigation";

export interface NavSubItem {
	titleKey: string;
	/** Path, optionally with a `?tab=` query for the tabbed account page. */
	href: string;
	/** Match the path exactly instead of as a prefix. */
	exact?: boolean;
	/** Active when the `tab` query is absent (account page default tab). */
	isDefaultTab?: boolean;
}

/** Kit org-settings item keys — anchors for `AppOrgSettingsNavItem.after`. */
export type OrgSettingsNavKey =
	| "general"
	| "members"
	| "billing"
	| "credits"
	| "apiKeys"
	| "webhooks"
	| "auditLog"
	| "danger";

/** Kit account-settings item keys — anchors for `AppAccountNavItem.after`. */
export type AccountNavKey =
	| "profile"
	| "security"
	| "sessions"
	| "billing"
	| "credits"
	| "apiKeys"
	| "danger";

/**
 * Kit admin item keys — anchors for `AppAdminNavItem.after`.
 * `"adminOverview"` is deprecated (the admin group has no overview item any
 * more) and resolves to the first admin item.
 */
export type AdminNavKey = "adminUsers" | "adminAuditLogs" | "adminOverview";

/** Deprecated anchor kept for existing `after:` values; see `AdminNavKey`. */
const DEPRECATED_ADMIN_OVERVIEW = "adminOverview";

interface AppNavItemBase<TAnchor extends string> {
	/** i18n key under `navigation.*`; also the item's unique key. */
	titleKey: string;
	/** Place directly after this kit item; omitted or hidden → appended. */
	after?: TAnchor;
	/** Match the path exactly instead of as a prefix. */
	exact?: boolean;
	/** Feature gate — `false` hides the item. Default `true`. */
	enabled?: boolean;
}

/** App item in the organization-settings group. */
export interface AppOrgSettingsNavItem
	extends AppNavItemBase<OrgSettingsNavKey> {
	/** Route segment under `/organizations/<slug>/settings/`. */
	segment: string;
	/** Shown only when the viewer's org role has this permission. */
	permission?: KnownPermission;
}

/** App item in the account-settings group. */
export interface AppAccountNavItem extends AppNavItemBase<AccountNavKey> {
	/** Absolute path, e.g. `/settings/integrations`. */
	href: string;
}

/** App item in the admin group (already system-admin only). */
export interface AppAdminNavItem extends AppNavItemBase<AdminNavKey> {
	/** Absolute path, e.g. `/admin/tenants`. */
	href: string;
}

function toNavSubItem(item: AppNavItemBase<string>, href: string): NavSubItem {
	return {
		titleKey: item.titleKey,
		href,
		...(item.exact ? { exact: true } : {}),
	};
}

function mergeAppItems<T extends AppNavItemBase<string>>(
	base: NavSubItem[],
	extras: readonly T[],
	toHref: (item: T) => string,
	visible: (item: T) => boolean = () => true,
): NavSubItem[] {
	return insertAfter(
		base,
		extras
			.filter((item) => item.enabled !== false && visible(item))
			.map((item) => ({
				after: item.after,
				item: toNavSubItem(item, toHref(item)),
			})),
		(item) => item.titleKey,
	);
}

export const ACCOUNT_SETTINGS_PATH = "/settings";
export const ADMIN_PATH = "/admin";
/** Where `/admin` redirects: the first admin item (groups have no overview page). */
export const ADMIN_HOME = `${ADMIN_PATH}/users`;

export function orgSettingsBase(slug: string): string {
	return `/organizations/${slug}/settings`;
}

export function orgBillingHref(slug: string): string {
	return `${orgSettingsBase(slug)}/billing`;
}

/**
 * `can` checks the viewer's org role for app items with a `permission`;
 * without it, permission-gated app items stay hidden (fail closed).
 */
export function getOrgSettingsItems(
	slug: string,
	canViewAuditLog: boolean,
	can?: (permission: KnownPermission) => boolean,
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
	return mergeAppItems(
		items,
		appOrgSettingsNavItems,
		(item) => `${base}/${item.segment}`,
		(item) => !item.permission || (can?.(item.permission) ?? false),
	);
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
	return mergeAppItems(items, appAccountNavItems, (item) => item.href);
}

export function getAdminItems(): NavSubItem[] {
	const items: NavSubItem[] = [
		{ titleKey: "adminUsers", href: ADMIN_HOME },
		{ titleKey: "adminAuditLogs", href: `${ADMIN_PATH}/audit-logs` },
	];
	const first = items[0]?.titleKey;
	return mergeAppItems(
		items,
		appAdminNavItems.map((item) =>
			item.after === DEPRECATED_ADMIN_OVERVIEW
				? { ...item, after: first }
				: item,
		),
		(item) => item.href,
	);
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
