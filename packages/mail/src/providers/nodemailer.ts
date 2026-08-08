import type { EmailProvider } from "../types";

/**
 * Nodemailer skeleton — inactive in v1.
 *
 * Useful for self-hosted SMTP (Postfix, Mailcow, OVH, …). Wire up with
 * `nodemailer` as an optional dep and configure via standard SMTP env
 * vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) — to be added
 * to `@fuutu/env/saas` at activation time.
 *
 * Intentionally not pulled as a dep now because it drags `nodemailer`'s
 * CommonJS tree into the bundle for all consumers.
 */
export const nodemailerProvider: EmailProvider = {
	name: "nodemailer",
	async send() {
		throw new Error(
			"[mail:nodemailer] provider skeleton — add `nodemailer` dep + SMTP_* env vars before selecting.",
		);
	},
};
