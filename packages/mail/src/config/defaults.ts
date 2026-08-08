/**
 * Email configuration defaults — owned by @fuutu/mail.
 *
 * Runtime overrides live in environment variables (EMAIL_PROVIDER, EMAIL_FROM)
 * and are resolved in `../config.ts`.
 */
import type { ProviderName } from "../types";

export const emailConfig = {
	/**
	 * Default email provider when EMAIL_PROVIDER env var is not set.
	 *
	 * v1 active: "plunk". Other entries are skeletons (throw on send) or
	 * dev-only (console/noop) — see `packages/mail/src/providers/*`.
	 *
	 * Dev fallback: when `plunk` is selected but no PLUNK_API_KEY is set,
	 * `resolveProvider()` downgrades to the console provider so developers
	 * see their emails in the terminal instead of getting auth errors.
	 */
	provider: "plunk" as ProviderName,
	/** Default From address when EMAIL_FROM is not set. */
	from: "Fuutu <noreply@fuutu.com>",
} as const;

export type EmailConfig = typeof emailConfig;
