import { passkeyClient } from "@better-auth/passkey/client";
import { polarClient } from "@polar-sh/better-auth/client";
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
 * - magicLinkClient: Magic link authentication
 * - multiSessionClient: Multiple device sessions
 * - organizationClient: Organization management
 * - polarClient: Polar payment integration
 */
const authClientOptions = {
	plugins: [
		inferAdditionalFields<typeof auth>(),
		adminClient(),
		magicLinkClient(),
		multiSessionClient(),
		organizationClient(),
		twoFactorClient(),
		usernameClient(),
		passkeyClient(),
		polarClient(),
		lastLoginMethodClient(),
	],
} satisfies BetterAuthClientOptions;

export const authClient: ReactAuthClient<typeof authClientOptions> =
	createAuthClient(authClientOptions);

export type AuthClient = typeof authClient;

/**
 * Error codes from Better Auth + custom codes
 */
export type AuthClientErrorCodes = typeof authClient.$ERROR_CODES;
