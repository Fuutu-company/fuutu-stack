/**
 * Which sign-in methods are actually live — the single source for both the
 * server plugin/provider registration (`./index.ts`) and the sign-in /
 * sign-up UI, so a button is never rendered for a method the server does
 * not serve.
 *
 * `AuthMethods` holds booleans only — safe to pass from a server component
 * to the client. `getAuthMethods()` reads server env and must stay
 * server-side; client code imports the type only.
 */
import { env } from "@fuutu/env/saas";
import { authConfig } from "./config";

export type SocialProviderId = "google" | "github";

export type OAuthCredentials = {
	clientId: string | undefined;
	clientSecret: string | undefined;
};

export type MethodsConfig = {
	features: {
		emailPassword: boolean;
		magicLink: boolean;
		passkeys: boolean;
		socialLogin: boolean;
	};
	socialProviders: Record<SocialProviderId, { enabled: boolean }>;
};

export type AuthMethods = {
	emailPassword: boolean;
	magicLink: boolean;
	passkey: boolean;
	google: boolean;
	github: boolean;
};

/**
 * A social provider is registered only when social login is on, the
 * provider is enabled, and both client id and secret are present.
 */
export function isSocialProviderActive(
	id: SocialProviderId,
	credentials: OAuthCredentials,
	cfg: MethodsConfig = authConfig,
): credentials is { clientId: string; clientSecret: string } {
	return (
		cfg.features.socialLogin &&
		cfg.socialProviders[id].enabled &&
		Boolean(credentials.clientId) &&
		Boolean(credentials.clientSecret)
	);
}

export function resolveAuthMethods(
	credentials: Record<SocialProviderId, OAuthCredentials>,
	cfg: MethodsConfig = authConfig,
): AuthMethods {
	return {
		emailPassword: cfg.features.emailPassword,
		magicLink: cfg.features.magicLink,
		passkey: cfg.features.passkeys,
		google: isSocialProviderActive("google", credentials.google, cfg),
		github: isSocialProviderActive("github", credentials.github, cfg),
	};
}

export function getSocialCredentials(): Record<
	SocialProviderId,
	OAuthCredentials
> {
	return {
		google: {
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
		},
		github: {
			clientId: env.GITHUB_CLIENT_ID,
			clientSecret: env.GITHUB_CLIENT_SECRET,
		},
	};
}

/** Server-only: the live sign-in methods for this deployment. */
export function getAuthMethods(): AuthMethods {
	return resolveAuthMethods(getSocialCredentials());
}
