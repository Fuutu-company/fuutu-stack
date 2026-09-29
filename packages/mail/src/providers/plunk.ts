import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import type { EmailProvider } from "../types";

/**
 * Plunk email provider (https://useplunk.com).
 *
 * Plunk's public send endpoint is a single POST to `/v1/send` with a bearer
 * API key. That lets us stay SDK-free — a dependency-light `fetch()` call
 * keeps the package installable without pulling in a network SDK and keeps
 * the bundle edge-runtime friendly.
 *
 * Endpoint reference: https://docs.useplunk.com/api-reference/transactional/send
 */
const PLUNK_ENDPOINT = "https://api.useplunk.com/v1/send";

const log = createLogger({ scope: "mail:plunk" });

export const plunkProvider: EmailProvider = {
	name: "plunk",
	async send(message) {
		const apiKey = env.PLUNK_API_KEY;
		if (!apiKey) {
			throw new Error(
				"[mail:plunk] PLUNK_API_KEY is not set. Refusing to send to prevent silent drops.",
			);
		}

		// Plunk `/v1/send` accepts a single `body` (HTML) field and
		// auto-derives the plain-text alternative — there is no `type`/
		// `subtype` field, so we send only what the API consumes.
		const body = {
			to: message.to,
			subject: message.subject,
			body: message.html,
			from: message.from,
			reply: message.replyTo,
		};

		const res = await fetch(PLUNK_ENDPOINT, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(body),
		});

		if (!res.ok) {
			// Plunk returns JSON with `{ code, message }`; treat 4xx as
			// permanent errors (bad key, banned recipient) and 5xx as
			// transient so upstream callers can differentiate.
			const text = await res.text().catch(() => "");
			log.error("plunk send failed", {
				status: res.status,
				to: message.to,
				body: text.slice(0, 500),
			});
			throw new Error(
				`[mail:plunk] send failed with status ${res.status}: ${text.slice(0, 200)}`,
			);
		}
	},
};
