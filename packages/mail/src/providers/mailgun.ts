import type { EmailProvider } from "../types";

/**
 * Mailgun skeleton — inactive in v1.
 *
 * Implement against https://documentation.mailgun.com/docs/mailgun/api-reference/openapi-final/tag/Messages/
 * (HTTP Basic with `api:<MAILGUN_API_KEY>`). Provider surface intentionally
 * mirrors plunk/resend so switching is a single env change.
 */
export const mailgunProvider: EmailProvider = {
	name: "mailgun",
	async send() {
		throw new Error(
			"[mail:mailgun] provider skeleton — implement before selecting EMAIL_PROVIDER=mailgun.",
		);
	},
};
