import { getUserById } from "@fuutu/db";
import { isValidLocale, type Locale } from "@fuutu/i18n";
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
		let locale: Locale | undefined =
			typeof data?.locale === "string" && isValidLocale(data.locale)
				? data.locale
				: undefined;

		if (!email || !name) {
			const user = await getUserById(userId);
			email ??= user?.email;
			name ??= user?.name;
			if (!locale && user?.locale && isValidLocale(user.locale)) {
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
