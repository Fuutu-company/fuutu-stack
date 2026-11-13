import { db } from "../client";

/**
 * MCP OAuth (`@better-auth/oauth-provider`) clients, consents and tokens.
 * Writes that the provider performs itself (registration, consent, token
 * issuance) stay in Better Auth; these cover what the provider lacks:
 * complete revocation, the connected-apps listing and stale-client cleanup.
 */

type OAuthClientOwnership = {
	userId: string | null;
	referenceId: string | null;
	skipConsent: boolean | null;
};

/**
 * A client nobody vouches for: no owning user or reference (org) — i.e.
 * registered through open dynamic client registration — and not marked
 * trusted (`skipConsent`) by an admin. Its name and URIs are self-asserted.
 */
export const isUnverifiedOAuthClient = (client: OAuthClientOwnership) =>
	!client.userId && !client.referenceId && client.skipConsent !== true;

export const getOAuthClientSummary = (clientId: string) =>
	db.oauthClient.findUnique({
		where: { clientId },
		select: {
			clientId: true,
			name: true,
			uri: true,
			icon: true,
			userId: true,
			referenceId: true,
			skipConsent: true,
			disabled: true,
		},
	});

export const getOAuthConsentOwner = (id: string) =>
	db.oauthConsent.findUnique({
		where: { id },
		select: { userId: true, clientId: true },
	});

export type OAuthConnectedApp = {
	clientId: string;
	name: string | null;
	uri: string | null;
	unverified: boolean;
	/** Earliest consent the user gave this client. */
	grantedAt: Date;
	/** Union of the scopes granted across the user's consents. */
	scopes: string[];
	/** Organizations the consents were given in (consent `referenceId`). */
	organizations: string[];
};

/** The user's OAuth consents, one entry per client. */
export async function listOAuthConnectedApps(
	userId: string,
): Promise<OAuthConnectedApp[]> {
	const consents = await db.oauthConsent.findMany({
		where: { userId },
		orderBy: [{ createdAt: "asc" }, { id: "asc" }],
		select: {
			clientId: true,
			scopes: true,
			referenceId: true,
			createdAt: true,
			client: {
				select: {
					name: true,
					uri: true,
					icon: true,
					userId: true,
					referenceId: true,
					skipConsent: true,
				},
			},
		},
	});

	const orgIds = [
		...new Set(consents.flatMap((c) => (c.referenceId ? [c.referenceId] : []))),
	];
	const orgNames = new Map(
		orgIds.length
			? (
					await db.organization.findMany({
						where: { id: { in: orgIds } },
						select: { id: true, name: true },
					})
				).map((org) => [org.id, org.name])
			: [],
	);

	const apps = new Map<string, OAuthConnectedApp>();
	for (const consent of consents) {
		const app = apps.get(consent.clientId) ?? {
			clientId: consent.clientId,
			name: consent.client.name,
			uri: consent.client.uri,
			unverified: isUnverifiedOAuthClient(consent.client),
			grantedAt: consent.createdAt,
			scopes: [],
			organizations: [],
		};
		for (const scope of consent.scopes) {
			if (!app.scopes.includes(scope)) app.scopes.push(scope);
		}
		const orgName = consent.referenceId && orgNames.get(consent.referenceId);
		if (orgName && !app.organizations.includes(orgName)) {
			app.organizations.push(orgName);
		}
		if (consent.createdAt < app.grantedAt) app.grantedAt = consent.createdAt;
		apps.set(consent.clientId, app);
	}
	return [...apps.values()];
}

/**
 * Disconnects a client from a user: every consent (all organizations),
 * refresh token and stored access token of that user+client, atomically.
 * Already-issued JWT access tokens are stateless and stay valid until they
 * expire (`accessTokenExpiresIn`).
 */
export async function revokeOAuthClientAccess(
	userId: string,
	clientId: string,
): Promise<{ accessTokens: number; refreshTokens: number; consents: number }> {
	const where = { userId, clientId };
	const [accessTokens, refreshTokens, consents] = await db.$transaction([
		db.oauthAccessToken.deleteMany({ where }),
		db.oauthRefreshToken.deleteMany({ where }),
		db.oauthConsent.deleteMany({ where }),
	]);
	return {
		accessTokens: accessTokens.count,
		refreshTokens: refreshTokens.count,
		consents: consents.count,
	};
}

/**
 * Revokes every OAuth refresh and stored access token of a user — or of
 * one of their clients (password change, "revoke all sessions", consent
 * deletion). Consents stay: reconnecting needs a new authorization in the
 * user's browser session.
 */
export async function revokeOAuthTokensForUser(
	userId: string,
	clientId?: string,
): Promise<{ accessTokens: number; refreshTokens: number }> {
	const where = clientId ? { userId, clientId } : { userId };
	const [accessTokens, refreshTokens] = await db.$transaction([
		db.oauthAccessToken.deleteMany({ where }),
		db.oauthRefreshToken.deleteMany({ where }),
	]);
	return {
		accessTokens: accessTokens.count,
		refreshTokens: refreshTokens.count,
	};
}

/**
 * Deletes unverified (owner-less, see `isUnverifiedOAuthClient`) clients
 * created before `createdBefore` that never got a consent or a token —
 * leftovers of open dynamic client registration.
 */
export const deleteStaleUnownedOAuthClients = (createdBefore: Date) =>
	db.oauthClient.deleteMany({
		where: {
			userId: null,
			referenceId: null,
			OR: [{ skipConsent: null }, { skipConsent: false }],
			createdAt: { lt: createdBefore },
			consents: { none: {} },
			refreshTokens: { none: {} },
			accessTokens: { none: {} },
		},
	});
