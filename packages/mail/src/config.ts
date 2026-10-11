import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import { emailConfig } from "./config/defaults";
import { consoleProvider } from "./providers/console";
import { mailgunProvider } from "./providers/mailgun";
import { nodemailerProvider } from "./providers/nodemailer";
import { noopProvider } from "./providers/noop";
import { plunkProvider } from "./providers/plunk";
import { postmarkProvider } from "./providers/postmark";
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
	const configured: ProviderName = env.EMAIL_PROVIDER ?? emailConfig.provider;

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
			// Skeleton providers: return them so the misconfiguration fails
			// loudly at send-time — downgrading to console would silently
			// route password-reset/verification mail to stdout in prod.
			return postmarkProvider;
		case "mailgun":
			return mailgunProvider;
		case "nodemailer":
			return nodemailerProvider;
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
