import { getUserById } from "@fuutu/db";
import { isKnownLocale } from "@fuutu/i18n";
import { createLogger } from "@fuutu/logs";
import { sendEmail } from "@fuutu/mail";
import type { NotificationChannelHandler } from "../types";

const log = createLogger({ scope: "notifications:email" });

/**
 * Email channel — resolves the recipient address (and display name /
 * locale) from the user record when not provided explicitly in `data`.
 * An explicit `data.email` always wins, letting callers override the
 * recipient (e.g. billing contact). The user lookup is skipped only when
 * both `email` and `name` are provided.
 */
export const emailChannel: NotificationChannelHandler = {
	channel: "email",
	async send(userId, type, title, body, data) {
		let email = typeof data?.email === "string" ? data.email : undefined;
		let name = typeof data?.name === "string" ? data.name : undefined;
		// Stored user-supplied locale tags are sanitized with isKnownLocale:
		// dormant-but-real locales (bundles wired, not routable) are kept,
		// garbage tags are dropped.
		let locale: string | undefined =
			typeof data?.locale === "string" && isKnownLocale(data.locale)
				? data.locale
				: undefined;

		if (!email || !name) {
			const user = await getUserById(userId);
			email ??= user?.email;
			name ??= user?.name;
			if (!locale && user?.locale && isKnownLocale(user.locale)) {
				locale = user.locale;
			}
		}

		if (!email) {
			log.warn("email channel skipped — could not resolve recipient address", {
				userId,
				type,
			});
			return;
		}

		await sendEmail({
			to: email,
			template: "notification",
			data: {
				name,
				title,
				body,
				appUrl: typeof data?.appUrl === "string" ? data.appUrl : undefined,
				locale,
			},
			subject: title,
		});
	},
};
