import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import { emailConfig } from "./config/defaults";
import { consoleProvider } from "./providers/console";
import { noopProvider } from "./providers/noop";
import { plunkProvider } from "./providers/plunk";
import { resendProvider } from "./providers/resend";
import type { EmailProvider, ProviderName } from "./types";

const log = createLogger({ scope: "mail:config" });

/**
 * Resolve the active provider from config + validated environment.
 *
 * Priority:
 *   1. env.EMAIL_PROVIDER (runtime override, validated by @fuutu/env/saas)
 *   2. emailConfig.provider (static default from @fuutu/mail/config)
 *   3. "console" (dev fallback)
 *
 * Safety: if a real provider is selected but its API key is missing we
 * downgrade to the console provider and log a warning instead of letting
 * every outgoing mail throw at send-time. This keeps dev installs working
 * out-of-the-box.
 */
export function resolveProvider(): EmailProvider {
	// `env.EMAIL_PROVIDER` is already a z.enum in `@fuutu/env/saas`, so
	// no cast is needed — a typo in the env would fail validation at
	// boot rather than silently reach this switch.
	const configured: ProviderName =
		env.EMAIL_PROVIDER ?? emailConfig.provider ?? "console";

	switch (configured) {
		case "console":
			return consoleProvider;
		case "noop":
			return noopProvider;
		case "plunk":
			if (!env.PLUNK_API_KEY) {
				log.warn(
					"EMAIL_PROVIDER=plunk but PLUNK_API_KEY is not set — falling back to console provider.",
				);
				return consoleProvider;
			}
			return plunkProvider;
		case "resend":
			if (!env.RESEND_API_KEY) {
				log.warn(
					"EMAIL_PROVIDER=resend but RESEND_API_KEY is not set — falling back to console provider.",
				);
				return consoleProvider;
			}
			return resendProvider;
		case "postmark":
		case "mailgun":
		case "nodemailer":
			// Skeleton providers — keep the config enum complete but do not
			// crash every outgoing mail in prod. Downgrade to console with
			// a loud warning, mirroring the `resend`/`plunk` missing-key path.
			log.warn(
				`EMAIL_PROVIDER=${configured} is a skeleton (not implemented yet) — falling back to console provider.`,
			);
			return consoleProvider;
		default:
			log.warn(`unknown provider "${configured}", falling back to console.`);
			return consoleProvider;
	}
}

/**
 * Resolve the From address.
 * Validated env EMAIL_FROM overrides config.email.from.
 */
export function resolveFromAddress(): string {
	return env.EMAIL_FROM ?? emailConfig.from;
}
