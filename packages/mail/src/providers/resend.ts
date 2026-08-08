import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import type { EmailProvider } from "../types";

/**
 * Resend provider (https://resend.com) — SDK-free implementation.
 *
 * Skeleton (not the v1-active provider — Plunk is active). Kept
 * dependency-less on purpose: pulling the `resend` SDK adds weight for
 * a one-endpoint POST with a bearer token.
 */
const RESEND_ENDPOINT = "https://api.resend.com/emails";

const log = createLogger({ scope: "mail:resend" });

export const resendProvider: EmailProvider = {
	name: "resend",
	async send(message) {
		const apiKey = env.RESEND_API_KEY;
		if (!apiKey) {
			throw new Error(
				"[mail:resend] RESEND_API_KEY is not set. Refusing to send.",
			);
		}

		const res = await fetch(RESEND_ENDPOINT, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				from: message.from,
				to: message.to,
				subject: message.subject,
				html: message.html,
				text: message.text,
				reply_to: message.replyTo,
			}),
		});

		if (!res.ok) {
			const text = await res.text().catch(() => "");
			log.error("resend send failed", {
				status: res.status,
				to: message.to,
				body: text.slice(0, 500),
			});
			throw new Error(
				`[mail:resend] send failed with status ${res.status}: ${text.slice(0, 200)}`,
			);
		}
	},
};
