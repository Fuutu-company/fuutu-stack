import {
	DESKTOP_ORG_CLAIM,
	verifyDesktopAccessToken,
} from "@fuutu/auth/desktop-oauth";
import { isBanActive } from "@fuutu/auth/types";
import { getUserById } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { z } from "zod";

const log = createLogger({ scope: "desktop-auth" });

/** A request authenticated with a desktop access token (`context.desktop`). */
export type DesktopAuth = {
	clientId: string;
	/** Token id (`jti`) — keys rate limits per token. */
	tokenId: string;
	/** Organization active at sign-in (token claim) — the app's default org. */
	organizationId: string | null;
};

const claimsSchema = z.object({
	sub: z.string().min(1),
	azp: z.string().min(1),
	jti: z.string().min(1).optional(),
	[DESKTOP_ORG_CLAIM]: z.string().min(1).optional(),
});

export type DesktopBearerResult = {
	user: NonNullable<Awaited<ReturnType<typeof getUserById>>>;
	desktop: DesktopAuth;
};

/**
 * Resolves a desktop access token (audience = desktop resource, `azp` =
 * desktop client — `verifyDesktopAccessToken`). Null for anything else:
 * MCP-audience tokens, foreign clients, expired or forged tokens, deleted
 * or banned users.
 */
export async function resolveDesktopBearer(
	token: string,
): Promise<DesktopBearerResult | null> {
	let raw: unknown;
	try {
		raw = await verifyDesktopAccessToken(token);
	} catch (err) {
		log.info("desktop access token rejected", { err: String(err) });
		return null;
	}
	const parsed = claimsSchema.safeParse(raw);
	if (!parsed.success) return null;
	const claims = parsed.data;
	const user = await getUserById(claims.sub);
	if (!user || isBanActive(user)) return null;
	return {
		user,
		desktop: {
			clientId: claims.azp,
			tokenId: claims.jti ?? `${claims.sub}:${claims.azp}`,
			organizationId: claims[DESKTOP_ORG_CLAIM] ?? null,
		},
	};
}
