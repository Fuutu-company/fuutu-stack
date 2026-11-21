import { z } from "zod";

/**
 * `desktop.session` response — what the app knows about its account. Shared
 * by the API (output schema) and the app (parses the response, caches it
 * for offline use).
 */
export const desktopSessionSchema = z.object({
	user: z.object({
		id: z.string(),
		name: z.string(),
		email: z.string(),
		image: z.string().nullable(),
	}),
	organization: z
		.object({ id: z.string(), name: z.string(), slug: z.string() })
		.nullable(),
	organizations: z.array(
		z.object({ id: z.string(), name: z.string(), slug: z.string() }),
	),
	plan: z.object({ id: z.string(), tier: z.string() }),
	entitlements: z.array(z.string()),
	access: z.object({
		status: z.enum(["granted", "trial", "missing", "device_limit"]),
		trialEndsAt: z.iso.datetime().nullable(),
		maxLicensedMajor: z.number().int().nullable(),
	}),
	devices: z.object({
		count: z.number().int(),
		limit: z.number().int().nullable(),
	}),
	/**
	 * Signed (EdDSA, the backend's JWKS) short-lived proof of access for the
	 * offline grace period — null without access.
	 */
	offline: z
		.object({ token: z.string(), expiresAt: z.iso.datetime() })
		.nullable(),
	/** Browser pages for "Buy" / "Manage account" (system browser). */
	links: z.object({
		billing: z.string(),
		account: z.string(),
		devices: z.string(),
	}),
});

export type DesktopSession = z.infer<typeof desktopSessionSchema>;

/** `aud` of the offline claim — never accepted as an API access token. */
export const offlineClaimAudience = (clientId: string) => `${clientId}:offline`;
