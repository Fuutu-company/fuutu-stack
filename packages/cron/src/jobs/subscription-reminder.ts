import { getTrialingSubscriptions, notificationExists } from "@fuutu/db";
import { getMessagesForLocale } from "@fuutu/i18n";
import { i18nConfig } from "@fuutu/i18n/config";
import { createLogger } from "@fuutu/logs";
import { resolveNotificationProvider } from "@fuutu/notifications";
import { cronConfig } from "../config";
import type { CronJob, CronJobResult } from "../types";

const log = createLogger({ scope: "cron:subscription-reminder" });

type TrialingPurchase = Awaited<
	ReturnType<typeof getTrialingSubscriptions>
>[number];

type ReminderRecipient = { userId: string; locale: string | null };

/**
 * Reminder lead time: notify when a trial's `currentPeriodEnd` falls
 * within this many days. Matches the "ending soon" promise of the
 * `cron.subscriptionReminder` message copy.
 */
const TRIAL_REMINDER_WINDOW_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Build a deterministic notification ID so the job is idempotent across
 * restarts, concurrent runners, and manual `runJob` invocations.
 * One reminder per purchase per recipient per day.
 */
const buildReminderNotificationId = (
	purchaseId: string,
	userId: string,
	date: Date,
): string => {
	const yyyy = date.getUTCFullYear();
	const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(date.getUTCDate()).padStart(2, "0");
	return `${purchaseId}-${userId}-${yyyy}-${mm}-${dd}`;
};

/**
 * `member.role` is a comma-separated Better-Auth role string
 * (e.g. "admin,owner"). Exact-match "owner" — never a substring check,
 * which would also match custom roles like "co-owner".
 */
const isOrgOwner = (role: string): boolean =>
	role
		.split(",")
		.map((part) => part.trim())
		.includes("owner");

/**
 * Resolve who receives the reminder for a purchase.
 * User-owned purchases notify that user; organization-owned purchases
 * (userId is null) notify all members holding the org "owner" role.
 */
const resolveReminderRecipients = (
	purchase: TrialingPurchase,
): ReminderRecipient[] => {
	if (purchase.userId) {
		return [{ userId: purchase.userId, locale: purchase.user?.locale ?? null }];
	}
	return (purchase.organization?.members ?? [])
		.filter((member) => isOrgOwner(member.role))
		.map((member) => ({
			userId: member.user.id,
			locale: member.user.locale,
		}));
};

/**
 * True when `err` is (or aggregates) only unique violations on the
 * deterministic notification ID — the signature of a lost concurrent-
 * runner race: the winner's row landed between our existence check and
 * our send, so our in-app insert hit P2002.
 *
 * Every other failure must be recorded. Our own `notify()` may create
 * the in-app row and then fail on another channel — a post-failure
 * existence check cannot tell that partial row apart from a winner's
 * row, so the error itself is the only honest signal.
 */
/** Surface the inner channel failures of a provider AggregateError. */
const errorMessage = (err: unknown): string => {
	if (err instanceof AggregateError) {
		const inner = err.errors
			.map((e) => (e instanceof Error ? e.message : String(e)))
			.join("; ");
		return inner || err.message;
	}
	return err instanceof Error ? err.message : String(err);
};

const isLostRaceError = (err: unknown): boolean => {
	const failures = err instanceof AggregateError ? err.errors : [err];
	return (
		failures.length > 0 &&
		failures.every(
			(f) => f instanceof Error && "code" in f && f.code === "P2002",
		)
	);
};

/**
 * Find trialing subscriptions ending soon and send reminder
 * notifications. Idempotent: constructs a deterministic notification ID
 * from `{purchaseId}-{userId}-{YYYY-MM-DD}` and skips if a notification
 * with that ID already exists. The ID is also the notification primary
 * key, so a concurrent runner that wins the insert race surfaces as a
 * unique-violation error — treated as "already sent", not a job error.
 */
export const subscriptionReminderJob: CronJob = {
	name: "subscription-reminder",
	schedule: "0 9 * * *",
	get enabled() {
		return cronConfig.jobs.subscriptionReminder;
	},
	async run(): Promise<CronJobResult> {
		const errors: string[] = [];

		try {
			const now = new Date();
			const windowEnd = new Date(
				now.getTime() + TRIAL_REMINDER_WINDOW_DAYS * DAY_MS,
			);
			const trialing = await getTrialingSubscriptions(now, windowEnd);

			const provider = resolveNotificationProvider();
			let processed = 0;

			for (const purchase of trialing) {
				const recipients = resolveReminderRecipients(purchase);
				if (recipients.length === 0 && purchase.organizationId) {
					log.warn("org-owned purchase has no owner members", {
						purchaseId: purchase.id,
						organizationId: purchase.organizationId,
					});
				}

				for (const recipient of recipients) {
					const notificationId = buildReminderNotificationId(
						purchase.id,
						recipient.userId,
						now,
					);
					if (await notificationExists(notificationId)) continue;

					const locale = recipient.locale ?? i18nConfig.defaultLocale;
					const messages = await getMessagesForLocale(locale);
					const title = messages.cron.subscriptionReminder.title;
					const body = messages.cron.subscriptionReminder.body;

					try {
						await provider.notify(
							recipient.userId,
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
						// Lost a concurrent-runner race: the deterministic ID was
						// created between our check and the insert. Already sent.
						if (isLostRaceError(err)) continue;
						errors.push(
							`purchase ${purchase.id} user ${recipient.userId}: ${errorMessage(err)}`,
						);
					}
				}
			}

			return { success: errors.length === 0, processed, errors };
		} catch (err) {
			errors.push(err instanceof Error ? err.message : String(err));
			return { success: false, processed: 0, errors };
		}
	},
};
