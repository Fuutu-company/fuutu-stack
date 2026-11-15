import {
	deleteExpiredVerifications,
	deleteRateLimitsBefore,
	deleteSessionsExpiredBefore,
} from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { cronConfig } from "../config";
import type { CronJob, CronJobResult } from "../types";

const log = createLogger({ scope: "cron:auth-retention-cleanup" });

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Sessions are kept this long after they expired. */
const SESSION_GRACE_DAYS = 7;
/** Rate-limit counters older than this carry no information (windows are seconds). */
const RATE_LIMIT_MAX_AGE_HOURS = 24;

/**
 * Retention for Better Auth housekeeping data: sessions expired more than
 * 7 days ago (they hold IP address and user agent), verification rows
 * (email / reset / magic-link tokens) past their `expiresAt`, and
 * database-backed rate-limit counters older than 24 hours (keyed by
 * client IP). Better Auth never deletes these itself.
 */
export const authRetentionCleanupJob: CronJob = {
	name: "auth-retention-cleanup",
	schedule: "45 3 * * *",
	get enabled() {
		return cronConfig.jobs.authRetentionCleanup;
	},
	async run(): Promise<CronJobResult> {
		try {
			const now = Date.now();
			const sessions = await deleteSessionsExpiredBefore(
				new Date(now - SESSION_GRACE_DAYS * DAY_MS),
			);
			const verifications = await deleteExpiredVerifications(new Date(now));
			const rateLimits = await deleteRateLimitsBefore(
				new Date(now - RATE_LIMIT_MAX_AGE_HOURS * HOUR_MS),
			);
			const processed = sessions.count + verifications.count + rateLimits.count;
			if (processed > 0) {
				log.info("deleted expired auth data", {
					sessions: sessions.count,
					verifications: verifications.count,
					rateLimits: rateLimits.count,
				});
			}
			return { success: true, processed, errors: [] };
		} catch (err) {
			return {
				success: false,
				processed: 0,
				errors: [err instanceof Error ? err.message : String(err)],
			};
		}
	},
};
