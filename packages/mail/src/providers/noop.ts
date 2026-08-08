import type { EmailProvider } from "../types";

/**
 * No-op provider — silently drops messages.
 * Useful for tests or CI where email delivery is not desired.
 */
export const noopProvider: EmailProvider = {
	name: "noop",
	async send() {
		// intentionally empty
	},
};
