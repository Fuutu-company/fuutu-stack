import type { FEATURE_CATALOG } from "@fuutu/payments/config";

/**
 * Desktop app configuration — owned by @fuutu/desktop (like `authConfig`).
 *
 * Inert unless `config.features.desktop` (`@fuutu/config`) is `true`: with
 * the switch off no desktop route, procedure, OAuth client, settings
 * section, download page or CI job exists, whatever this file says.
 *
 * Product name, bundle id, deep-link scheme, keychain service and updater
 * user agent derive from `config.app` (`./identity`) — set
 * `identity.*` only to override them. Never use the names "Fuutu" /
 * "Fuutu Stack" in them (LICENSE.md §8).
 */

/** A flat `FEATURE_CATALOG` id, e.g. `"api_webhooks"`. */
export type DesktopFeatureId = {
	[G in keyof typeof FEATURE_CATALOG]: `${G & string}_${keyof (typeof FEATURE_CATALOG)[G] & string}`;
}[keyof typeof FEATURE_CATALOG];

/**
 * - `required`: no access without a signed-in account (with offline grace).
 * - `optional`: the app runs locally; signing in unlocks online features —
 *   the end user chooses.
 * - `off`: local-only app, no backend, no sign-in code path.
 */
export type DesktopAuthMode = "required" | "optional" | "off";

export const DESKTOP_CHANNELS = ["stable", "beta"] as const;
export type DesktopChannel = (typeof DESKTOP_CHANNELS)[number];

/**
 * Linux bundles a release can ship. Only `appimage` updates itself; `deb`
 * and `rpm` installs update through the system package manager.
 */
export const DESKTOP_LINUX_FORMATS = ["appimage", "deb", "rpm"] as const;
export type DesktopLinuxFormat = (typeof DESKTOP_LINUX_FORMATS)[number];

export const desktopConfig = {
	auth: "required" as DesktopAuthMode,
	/** Days a signed-in app keeps working without reaching the backend. */
	offlineGraceDays: 7,
	access: {
		/**
		 * Plan feature that unlocks the app (`FEATURE_CATALOG`, flat id) —
		 * `null`: every signed-in account has access.
		 */
		requiredFeature: null as DesktopFeatureId | null,
		/**
		 * Licence per major version: an entitlement unlocks one major
		 * (all 1.x); the updater never offers a higher major than licensed.
		 */
		perMajorVersion: true,
		/**
		 * Feature per major version (`{ 2: "products_noor_v2" }`). A major
		 * without an entry is unlocked by `requiredFeature` — so a free
		 * upgrade needs no entry.
		 */
		majors: {} as Partial<Record<number, DesktopFeatureId>>,
	},
	devices: {
		/** Signed-in desktop installs per account; `null` = unlimited. */
		limit: 3 as number | null,
	},
	trial: {
		/** Days of access from sign-up without the required feature; `null` = no trial. */
		days: null as number | null,
	},
	updates: {
		/**
		 * - `backend`: the app asks `apps/saas` (`/api/desktop/updates/…`),
		 *   which hands out short-lived download URLs from the private bucket.
		 * - `static`: the app reads a public manifest
		 *   (`NEXT_PUBLIC_DESKTOP_UPDATE_URL`) — for apps without a backend.
		 */
		source: "backend" as "backend" | "static",
		channels: DESKTOP_CHANNELS,
		defaultChannel: "stable" as DesktopChannel,
		/** Background check interval while the app runs. */
		checkIntervalHours: 6,
	},
	release: {
		/**
		 * Linux bundles `pnpm build:desktop` builds and a release publishes.
		 * With `appimage` the AppImage is the download and updates itself
		 * (the other formats are built but not published). Without it
		 * (e.g. `["deb", "rpm"]`, when a bundled library's licence rules out
		 * an AppImage) every listed package is a download, the first one on
		 * the download page, and Linux installs update through the package
		 * manager — the release has no Linux updater entry.
		 */
		linuxFormats: ["appimage", "deb"] as DesktopLinuxFormat[],
	},
	shell: {
		/** Tray icon with show / quit. */
		tray: true,
		/** Offer "Start at login" in the settings (off until the user turns it on). */
		autostart: true,
		/** A second launch focuses the running window instead. */
		singleInstance: true,
		/** Closing the main window hides it to the tray (needs `tray`). */
		closeToTray: false,
	},
	identity: {
		/** Reverse-DNS bundle id — default `app.<slug>.desktop`. */
		bundleId: undefined as string | undefined,
		/** Deep-link scheme — default `<slug without dashes>`. */
		scheme: undefined as string | undefined,
	},
} as const;

export type DesktopConfig = typeof desktopConfig;
