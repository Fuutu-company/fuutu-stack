import { getTrialingSubscriptions, notificationExists } from "@fuutu/db";
import { getMessagesForLocale } from "@fuutu/i18n";
import { resolveNotificationProvider } from "@fuutu/notifications";
import { cronConfig } from "../config";
import type { CronJob, CronJobResult } from "../types";

/**
 * Build a deterministic notification ID so the job is idempotent across
 * restarts and manual `runJob` invocations. One reminder per purchase per day.
 */
const buildReminderNotificationId = (
	purchaseId: string,
	date: Date,
): string => {
	const yyyy = date.getUTCFullYear();
	const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(date.getUTCDate()).padStart(2, "0");
	return `${purchaseId}-${yyyy}-${mm}-${dd}`;
};

/**
 * Find trialing subscriptions and send reminder notifications.
 * Idempotent: constructs a deterministic notification ID from
 * `{purchaseId}-{YYYY-MM-DD}` and skips if a notification with that ID
 * already exists.
 */
export const subscriptionReminderJob: CronJob = {
	name: "subscription-reminder",
	schedule: "0 9 * * *",
	enabled: cronConfig.jobs.subscriptionReminder,
	async run(): Promise<CronJobResult> {
		const errors: string[] = [];

		try {
			const trialing = await getTrialingSubscriptions();

			const provider = resolveNotificationProvider();
			const now = new Date();
			let processed = 0;

			for (const purchase of trialing) {
				const userId = purchase.userId;
				if (!userId) continue;

				const notificationId = buildReminderNotificationId(purchase.id, now);
				if (await notificationExists(notificationId)) continue;

				const locale = purchase.user?.locale ?? "en";
				const messages = await getMessagesForLocale(locale);
				const title = messages.cron.subscriptionReminder.title;
				const body = messages.cron.subscriptionReminder.body;

				try {
					await provider.notify(
						userId,
						"billing",
						title,
						body,
						{
							subscriptionId: purchase.subscriptionId,
						},
						{ id: notificationId },
					);
					processed++;
				} catch (err) {
					errors.push(
						`purchase ${purchase.id}: ${err instanceof Error ? err.message : String(err)}`,
					);
				}
			}

			return { success: errors.length === 0, processed, errors };
		} catch (err) {
			errors.push(err instanceof Error ? err.message : String(err));
			return { success: false, processed: 0, errors };
		}
	},
};
