import { passkeyClient } from "@better-auth/passkey/client";
import { config } from "@fuutu/config";
import type { BetterAuthClientOptions } from "better-auth";
import {
	adminClient,
	inferAdditionalFields,
	lastLoginMethodClient,
	magicLinkClient,
	multiSessionClient,
	organizationClient,
	twoFactorClient,
	usernameClient,
} from "better-auth/client/plugins";
import type { ReactAuthClient } from "better-auth/react";
import { createAuthClient } from "better-auth/react";
import { authConfig } from "./config";
import type { auth } from "./index";

/**
 * Auth client for frontend applications
 *
 * Uses the current origin for API calls (no baseURL needed)
 * API routes are handled by Next.js at /api/auth/*
 *
 * Plugins must match the server-side auth configuration:
 * - inferAdditionalFields: Syncs custom user fields with server
 * - adminClient: Admin features
 * - magicLinkClient: Magic link authentication (gated on features.magicLink)
 * - multiSessionClient: Multiple device sessions
 * - organizationClient: Organization management (gated on organizationsMode)
 * - twoFactorClient: 2FA (gated on features.twoFactor)
 * - passkeyClient: Passkeys (gated on features.passkeys)
 */
const authClientOptions = {
	plugins: [
		inferAdditionalFields<typeof auth>(),
		adminClient(),
		multiSessionClient(),
		usernameClient(),
		lastLoginMethodClient(),
		...(authConfig.features.magicLink ? [magicLinkClient()] : []),
		...(config.features.organizationsMode !== "off"
			? [organizationClient()]
			: []),
		...(authConfig.features.twoFactor ? [twoFactorClient()] : []),
		...(authConfig.features.passkeys ? [passkeyClient()] : []),
	],
} satisfies BetterAuthClientOptions;

export const authClient: ReactAuthClient<typeof authClientOptions> =
	createAuthClient(authClientOptions);

export type AuthClient = typeof authClient;

/**
 * Error codes from Better Auth + custom codes
 */
export type AuthClientErrorCodes = typeof authClient.$ERROR_CODES;
