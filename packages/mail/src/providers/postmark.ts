import type { EmailProvider } from "../types";

/**
 * Postmark skeleton — inactive in v1.
 *
 * Wire up by calling Postmark's `/email` endpoint (bearer token auth via
 * `X-Postmark-Server-Token`). The surface intentionally mirrors the other
 * providers so switching is a single env change:
 *
 *   EMAIL_PROVIDER=postmark
 *   POSTMARK_SERVER_TOKEN=<token>   // add to @fuutu/env/saas first
 */
export const postmarkProvider: EmailProvider = {
	name: "postmark",
	async send() {
		throw new Error(
			"[mail:postmark] provider skeleton — implement against https://postmarkapp.com/developer/api/email-api before selecting.",
		);
	},
};
