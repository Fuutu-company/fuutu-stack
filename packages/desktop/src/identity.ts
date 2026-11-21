import { config } from "@fuutu/config";
import { type DesktopConfig, desktopConfig } from "./config";

export type DesktopIdentity = {
	/** Window title, bundle name, About dialog. */
	productName: string;
	/** Lowercase dash slug of the product name. */
	slug: string;
	/** Reverse-DNS id (Tauri `identifier`, macOS bundle id, keychain service). */
	bundleId: string;
	/** Deep-link scheme, e.g. `acme` → `acme://auth/callback`. */
	scheme: string;
	/** OAuth `client_id` of the pre-registered desktop client. */
	oauthClientId: string;
	/** Service name for OS keychain entries. */
	keychainService: string;
	/** `User-Agent` the app sends to the backend and the updater. */
	userAgent: (appVersion: string) => string;
};

/** Lowercase ASCII slug: `"Acme Notes!"` → `"acme-notes"`. */
export function slugify(name: string): string {
	return (
		name
			.normalize("NFKD")
			.replace(/[̀-ͯ]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "app"
	);
}

/**
 * Desktop identity derived from the app name (`config.app.name`) — the kit
 * hard-codes no product name, bundle id or scheme (LICENSE.md §8).
 */
export function deriveDesktopIdentity(
	appName: string,
	identity: DesktopConfig["identity"] = desktopConfig.identity,
): DesktopIdentity {
	const slug = slugify(appName);
	const bundleId = identity.bundleId ?? `app.${slug}.desktop`;
	const scheme = identity.scheme ?? slug.replace(/-/g, "");
	const productName = appName.trim() || slug;
	return {
		productName,
		slug,
		bundleId,
		scheme,
		oauthClientId: `${slug}-desktop`,
		keychainService: bundleId,
		userAgent: (appVersion) => `${slug}-desktop/${appVersion}`,
	};
}

export const desktopIdentity: DesktopIdentity = deriveDesktopIdentity(
	config.app.name,
);
