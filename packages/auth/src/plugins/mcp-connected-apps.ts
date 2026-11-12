/**
 * "Connected apps" for MCP OAuth: lets a user see which OAuth clients hold
 * a grant on their account and disconnect them. The provider's own
 * `/oauth2/delete-consent` only deletes one consent row; revoking here
 * removes every consent, refresh token and stored access token of that
 * user+client (`revokeOAuthClientAccess`).
 */
import { listOAuthConnectedApps, revokeOAuthClientAccess } from "@fuutu/db";
import type { BetterAuthPlugin } from "better-auth";
import {
	APIError,
	createAuthEndpoint,
	sessionMiddleware,
} from "better-auth/api";

const MAX_CLIENT_ID_LENGTH = 255;
const REVOKE_PATH = "/mcp-oauth/connected-apps/revoke";

export type ConnectedApp = {
	clientId: string;
	name: string | null;
	uri: string | null;
	unverified: boolean;
	grantedAt: string;
	scopes: string[];
	organizations: string[];
};

export async function listConnectedApps(
	userId: string,
): Promise<ConnectedApp[]> {
	const apps = await listOAuthConnectedApps(userId);
	return apps.map((app) => ({
		...app,
		grantedAt: app.grantedAt.toISOString(),
	}));
}

/** Revokes the session user's grant for `body.clientId`; never another user's. */
export async function revokeConnectedApp(
	userId: string,
	body: unknown,
): Promise<void> {
	const clientId =
		typeof body === "object" && body !== null && "clientId" in body
			? body.clientId
			: undefined;
	if (
		typeof clientId !== "string" ||
		!clientId ||
		clientId.length > MAX_CLIENT_ID_LENGTH
	) {
		throw new APIError("BAD_REQUEST", { message: "Invalid client id" });
	}
	const revoked = await revokeOAuthClientAccess(userId, clientId);
	if (revoked.consents + revoked.refreshTokens + revoked.accessTokens === 0) {
		throw new APIError("NOT_FOUND", { message: "No connection found" });
	}
}

export const mcpConnectedApps = () =>
	({
		id: "mcp-connected-apps",
		endpoints: {
			listMcpConnectedApps: createAuthEndpoint(
				"/mcp-oauth/connected-apps",
				{ method: "GET", use: [sessionMiddleware] },
				async (ctx) =>
					ctx.json(await listConnectedApps(ctx.context.session.user.id)),
			),
			revokeMcpConnectedApp: createAuthEndpoint(
				REVOKE_PATH,
				{ method: "POST", use: [sessionMiddleware] },
				async (ctx) => {
					await revokeConnectedApp(ctx.context.session.user.id, ctx.body);
					return ctx.json({ success: true });
				},
			),
		},
		rateLimit: [
			{
				pathMatcher: (path: string) => path === REVOKE_PATH,
				window: 60,
				max: 10,
			},
		],
	}) satisfies BetterAuthPlugin;
