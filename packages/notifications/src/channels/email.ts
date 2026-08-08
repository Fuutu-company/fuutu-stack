import type { Locale } from "@fuutu/i18n";
import { createLogger } from "@fuutu/logs";
import { sendEmail } from "@fuutu/mail";
import type { NotificationChannelHandler } from "../types";

const log = createLogger({ scope: "notifications:email" });

export const emailChannel: NotificationChannelHandler = {
	channel: "email",
	async send(userId, type, title, body, data) {
		const email = (data?.email as string | undefined) ?? null;
		if (!email) {
			log.warn(
				"email channel skipped — no email address in notification data",
				{
					userId,
					type,
				},
			);
			return;
		}
		await sendEmail({
			to: email,
			template: "notification",
			data: {
				name: (data?.name as string | undefined) ?? undefined,
				title,
				body,
				appUrl: (data?.appUrl as string | undefined) ?? undefined,
				locale: (data?.locale as Locale | undefined) ?? undefined,
			},
			subject: title,
		});
	},
};
