import { randomUUID } from "node:crypto";
import { db } from "../client";

/**
 * Desktop app OAuth client (`config.features.desktop`): the pre-registered
 * first-party public client and its devices. A device is one signed-in
 * install = one live refresh-token chain of the desktop client.
 */

export type DesktopOAuthClientInput = {
	clientId: string;
	name: string;
	redirectUris: string[];
	scopes: string[];
	/** The desktop API resource (audience) — the ONLY resource it is linked to. */
	resource: string;
};

/**
 * Creates or refreshes the desktop client: public (no secret, PKCE
 * required), native, with a consent screen (RFC 8252 §8.6: a public native
 * client's identity cannot be verified, so another local program could
 * use the same client id), linked to exactly one
 * resource. Links to any other resource (e.g. the MCP audience) are removed.
 * Idempotent.
 */
export async function ensureDesktopOAuthClient(
	input: DesktopOAuthClientInput,
): Promise<void> {
	const now = new Date();
	const fields = {
		name: input.name,
		clientSecret: null,
		disabled: false,
		skipConsent: false,
		scopes: input.scopes,
		redirectUris: input.redirectUris,
		tokenEndpointAuthMethod: "none",
		applicationType: "native",
		grantTypes: ["authorization_code", "refresh_token"],
		responseTypes: ["code"],
		requirePKCE: true,
		userId: null,
		referenceId: null,
		updatedAt: now,
	};
	await db.$transaction([
		db.oauthClient.upsert({
			where: { clientId: input.clientId },
			create: {
				id: randomUUID(),
				clientId: input.clientId,
				createdAt: now,
				...fields,
			},
			update: fields,
		}),
		db.oauthClientResource.deleteMany({
			where: { clientId: input.clientId, resourceId: { not: input.resource } },
		}),
		db.oauthClientResource.upsert({
			where: {
				clientId_resourceId: {
					clientId: input.clientId,
					resourceId: input.resource,
				},
			},
			create: {
				id: randomUUID(),
				clientId: input.clientId,
				resourceId: input.resource,
				createdAt: now,
			},
			update: {},
		}),
	]);
}

export type DesktopDevice = {
	/** Refresh-token row id of the chain's live head. */
	id: string;
	signedInAt: Date;
	lastActiveAt: Date;
	expiresAt: Date;
};

const liveHead = (userId: string, clientId: string, now: Date) => ({
	userId,
	clientId,
	revoked: null,
	rotatedAt: null,
	expiresAt: { gt: now },
});

/** The user's signed-in desktop installs, most recently active first. */
export async function listDesktopDevices(
	userId: string,
	clientId: string,
	now = new Date(),
): Promise<DesktopDevice[]> {
	const heads = await db.oauthRefreshToken.findMany({
		where: liveHead(userId, clientId, now),
		orderBy: { createdAt: "desc" },
		// Far above any sensible device limit; bounds the read.
		take: 100,
		select: {
			id: true,
			createdAt: true,
			authTime: true,
			expiresAt: true,
		},
	});
	return heads.map((head) => ({
		id: head.id,
		signedInAt: head.authTime ?? head.createdAt,
		lastActiveAt: head.createdAt,
		expiresAt: head.expiresAt,
	}));
}

export const countDesktopDevices = (
	userId: string,
	clientId: string,
	now = new Date(),
) => db.oauthRefreshToken.count({ where: liveHead(userId, clientId, now) });

/**
 * Signs one install out: deletes its refresh-token head (and the access
 * tokens issued from it) — the app's next refresh fails with "session not
 * found" and it asks for a new sign-in. Deleted, not marked `revoked`:
 * Better Auth treats a revoked token presented again as token reuse and
 * invalidates EVERY refresh token of that user for the client, which would
 * sign out all their other devices too. Only the user's own CURRENT head
 * of this client — a stale id (the chain rotated since the list was
 * loaded) returns false, so the caller reloads instead.
 */
export async function revokeDesktopDevice(
	userId: string,
	clientId: string,
	deviceId: string,
): Promise<boolean> {
	const head = {
		id: deviceId,
		userId,
		clientId,
		revoked: null,
		rotatedAt: null,
	};
	const [, deleted] = await db.$transaction([
		db.oauthAccessToken.deleteMany({
			where: { refreshId: deviceId, userId, clientId },
		}),
		db.oauthRefreshToken.deleteMany({ where: head }),
	]);
	return deleted.count > 0;
}

/**
 * Removes every stored consent of the desktop client, so its next sign-in
 * shows the consent screen again (a public client — see
 * `clearDesktopConsentAfterSignIn` in `@fuutu/auth/desktop-oauth`).
 */
export async function clearDesktopOAuthConsents(
	clientId: string,
): Promise<void> {
	await db.oauthConsent.deleteMany({ where: { clientId } });
}
