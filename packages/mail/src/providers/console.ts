import { createLogger } from "@fuutu/logs";
import type { EmailProvider } from "../types";

const log = createLogger({ scope: "mail:console" });

/**
 * Console provider — logs emails to stdout in a readable box format.
 *
 * Intended for local development so you can see password-reset links,
 * verification tokens etc. without configuring a real SMTP service.
 */
export const consoleProvider: EmailProvider = {
	name: "console",
	async send(message) {
		const divider = "═".repeat(64);
		const lines = [
			"",
			`╔${divider}╗`,
			"║ EMAIL (console provider)",
			`╠${divider}╣`,
			`║ From:    ${message.from}`,
			`║ To:      ${message.to}`,
			`║ Subject: ${message.subject}`,
			...(message.replyTo ? [`║ ReplyTo: ${message.replyTo}`] : []),
			`╠${divider}╣`,
			"║ Plain text:",
			"",
			...message.text.split("\n").map((l) => `  ${l}`),
			"",
			`╚${divider}╝`,
			"",
		];
		log.info(lines.join("\n"));
	},
};
