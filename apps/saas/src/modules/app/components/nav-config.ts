import { config } from "@fuutu/config";
import { paymentsConfig } from "@fuutu/payments/config";
import type { KnownPermission } from "@fuutu/rbac";
import { insertAfter } from "@fuutu/utils/insert-after";
import {
	Bell,
	LayoutDashboard,
	type LucideIcon,
	MessageSquare,
	Users,
} from "lucide-react";
import { appMainNavItems } from "../../../app-main-nav";
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

/** Top-level item of the Platform group (`NavMain`). */
export interface MainNavItem {
	titleKey: string;
	url: string;
	icon: LucideIcon;
	/** Match the path exactly instead of as a prefix. */
	exact?: boolean;
}

/** Kit Platform-group item keys — anchors for `AppMainNavItem.after`. */
export type MainNavKey = "dashboard" | "aiChat" | "crm" | "notifications";

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
export type AdminNavKey =
	| "adminUsers"
	| "adminAuditLogs"
	| "adminOverview"
	| "adminOrganizations"
	| "adminSystem";

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
	/**
	 * Take this kit item's place (wins over `after`) — e.g. an app "Keys"
	 * page instead of the kit "API keys" item, without rewording kit text.
	 * The kit route keeps working.
	 *
	 * The replacement does NOT inherit the kit item's visibility: it is
	 * shown by its own `enabled` and `permission` only. Gate it yourself
	 * when the kit item was role-gated (e.g. `auditLog` is admin+).
	 * - Kit item hidden by a feature flag → the replacement is appended.
	 * - Kit item hidden by the viewer's role → appended only when the
	 *   replacement declares its own `permission` (and the role has it);
	 *   without one it is dropped, so it never shows to a role that could
	 *   not see the kit item.
	 * - Replacement hidden by `permission` → the kit item is removed anyway.
	 * - `enabled: false` → no replacement, the kit item stays.
	 * Two items replacing one key throw. An app item anchored `after` the
	 * replaced key lands behind the replacement.
	 */
	replaces?: OrgSettingsNavKey;
}

/** Where an app main-nav item links — exactly one of the three. */
type AppMainNavTarget =
	| {
			/** Scoped like the kit items: `/<segment>`, in an org `/organizations/<slug>/<segment>`. */
			segment: string;
			orgSegment?: never;
			href?: never;
	  }
	| {
			/** `/organizations/<slug>/<orgSegment>`; hidden outside org routes. */
			orgSegment: string;
			segment?: never;
			href?: never;
	  }
	| {
			/** Absolute path, the same everywhere. */
			href: string;
			segment?: never;
			orgSegment?: never;
	  };

/** App item in the Platform group (top-level sidebar items). */
export type AppMainNavItem = AppNavItemBase<MainNavKey> &
	AppMainNavTarget & {
		icon: LucideIcon;
		/**
		 * Shown only inside an org whose viewer role has this permission —
		 * outside org routes a permission-gated item is hidden (no role).
		 */
		permission?: KnownPermission;
	};

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
	anchorOf: (after: string | undefined) => string | undefined = (after) =>
		after,
): NavSubItem[] {
	return insertAfter(
		base,
		extras
			.filter((item) => item.enabled !== false && visible(item))
			.map((item) => ({
				after: anchorOf(item.after),
				item: toNavSubItem(item, toHref(item)),
			})),
		(item) => item.titleKey,
	);
}

/**
 * Platform group: kit items (demo modules per `config.features`) merged
 * with `appMainNavItems`. `orgSlug` null = personal routes; `can` checks
 * the viewer's org role for permission-gated app items (fail closed).
 */
export function getMainItems(
	orgSlug: string | null,
	can?: (permission: KnownPermission) => boolean,
): MainNavItem[] {
	const base = orgSlug ? `/organizations/${orgSlug}` : "";
	const items: MainNavItem[] = [
		{ titleKey: "dashboard", url: `${base}/dashboard`, icon: LayoutDashboard },
	];
	if (config.features.aiChat) {
		items.push({
			titleKey: "aiChat",
			url: `${base}/chat`,
			icon: MessageSquare,
		});
	}
	// CRM contacts belong to an organization: no CRM without organizations.
	if (config.features.crm && config.features.organizationsMode !== "off") {
		items.push({ titleKey: "crm", url: `${base}/crm`, icon: Users });
	}
	items.push({ titleKey: "notifications", url: "/notifications", icon: Bell });

	const urlOf = (item: AppMainNavItem): string | null => {
		if (item.href !== undefined) return item.href;
		if (item.orgSegment !== undefined) {
			return orgSlug ? `${base}/${item.orgSegment}` : null;
		}
		return `${base}/${item.segment}`;
	};
	const extras = appMainNavItems.flatMap((item) => {
		const url = urlOf(item);
		if (item.enabled === false || url === null) return [];
		if (item.permission && !(orgSlug && (can?.(item.permission) ?? false))) {
			return [];
		}
		return [
			{
				after: item.after,
				item: {
					titleKey: item.titleKey,
					url,
					icon: item.icon,
					...(item.exact ? { exact: true } : {}),
				},
			},
		];
	});
	return insertAfter(items, extras, (item) => item.titleKey);
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
	items.push({ titleKey: "apiKeys", href: `${base}/api-keys` });
	if (config.features.webhooks) {
		items.push({ titleKey: "webhooks", href: `${base}/webhooks` });
	}
	// Audit log requires AUDIT_LOG.VIEW (admin+) — hide rather than link to a
	// redirect dead-end for plain members.
	if (canViewAuditLog) {
		items.push({ titleKey: "auditLog", href: `${base}/audit-log` });
	}
	items.push({ titleKey: "danger", href: `${base}/danger` });
	const toHref = (item: AppOrgSettingsNavItem) => `${base}/${item.segment}`;
	const visible = (item: AppOrgSettingsNavItem) =>
		!item.permission || (can?.(item.permission) ?? false);
	// Kit items the viewer's role hides (not a feature flag).
	const hiddenByRole = new Set<string>(canViewAuditLog ? [] : ["auditLog"]);
	const {
		base: replaced,
		extras,
		replacedBy,
	} = applyReplacements(
		items,
		appOrgSettingsNavItems,
		toHref,
		visible,
		hiddenByRole,
	);
	return mergeAppItems(
		replaced,
		extras,
		toHref,
		visible,
		(after) => (after && replacedBy.get(after)) ?? after,
	);
}

/**
 * Swap kit items for app items that declare `replaces`. Returns the kit
 * list with replacements in place, the remaining extras (a replacement
 * whose kit item is hidden comes back as a plain, appended extra — for a
 * role-hidden kit item only when it declares its own `permission`) and the
 * replaced keys, so an `after` on one lands behind its replacement.
 */
function applyReplacements(
	base: NavSubItem[],
	extras: readonly AppOrgSettingsNavItem[],
	toHref: (item: AppOrgSettingsNavItem) => string,
	visible: (item: AppOrgSettingsNavItem) => boolean,
	hiddenByRole: ReadonlySet<string>,
): {
	base: NavSubItem[];
	extras: AppOrgSettingsNavItem[];
	/** Replaced kit key → the app item's key. */
	replacedBy: Map<string, string>;
} {
	const result = [...base];
	const replacedBy = new Map<string, string>();
	const rest: AppOrgSettingsNavItem[] = [];
	for (const item of extras) {
		if (!item.replaces || item.enabled === false) {
			rest.push(item);
			continue;
		}
		if (replacedBy.has(item.replaces)) {
			throw new Error(
				`nav-config: "${item.titleKey}" and "${replacedBy.get(item.replaces)}" both replace "${item.replaces}"`,
			);
		}
		replacedBy.set(item.replaces, item.titleKey);
		const index = result.findIndex((i) => i.titleKey === item.replaces);
		if (index === -1) {
			// A role-hidden kit item: no own permission → never show it.
			if (hiddenByRole.has(item.replaces) && !item.permission) continue;
			// Otherwise append like a missing anchor (visibility still applies).
			const { replaces: _replaces, after: _after, ...plain } = item;
			rest.push(plain);
			continue;
		}
		if (visible(item)) {
			result.splice(index, 1, toNavSubItem(item, toHref(item)));
		} else {
			result.splice(index, 1);
		}
	}
	return { base: result, extras: rest, replacedBy };
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
		{ titleKey: "adminOrganizations", href: `${ADMIN_PATH}/organizations` },
		{ titleKey: "adminAuditLogs", href: `${ADMIN_PATH}/audit-logs` },
		{ titleKey: "adminSystem", href: `${ADMIN_PATH}/system` },
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
