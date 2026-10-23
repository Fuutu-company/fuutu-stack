import { deleteAuditLogsBefore } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { LIMITS } from "@fuutu/payments/config";
import { cronConfig } from "../config";
import type { CronJob, CronJobResult } from "../types";

const log = createLogger({ scope: "cron:audit-log-cleanup" });

/**
 * Delete audit logs older than the maximum retention across all plans.
 *
 * `auditLogDays` (LIMITS) is a per-plan retention promise, but audit_log
 * rows carry no tenant/plan scoping (only `userId`), so retention cannot
 * be applied per plan. The global policy therefore satisfies every plan's
 * promise at once:
 * - If ANY plan advertises `"unlimited"`, nothing is deleted — a finite
 *   cutoff would break that plan's promise. True per-plan retention
 *   requires an org/plan column on audit_log (schema does not have one).
 * - If EVERY plan sets `auditLogDays: false`, nothing is deleted either:
 *   `false` means "audit-log feature disabled on this plan", not
 *   "zero-day retention". No plan promises retention, but nothing
 *   mandates purging existing rows — skipping is the fail-safe choice.
 * - Otherwise the highest finite value is used, so data is kept at least
 *   as long as the most generous plan promises (keeping longer is safe;
 *   deleting earlier than promised is not).
 *
 * Both no-op cases report `skipped: true` so the persisted run state
 * records "skipped" rather than a fake success-with-zero-work.
 */
export const auditLogCleanupJob: CronJob = {
	name: "audit-log-cleanup",
	schedule: "0 3 * * *",
	get enabled() {
		return cronConfig.jobs.auditLogCleanup;
	},
	async run(): Promise<CronJobResult> {
		const errors: string[] = [];
		const retention = getMaxAuditLogRetentionDays();

		if (retention.kind === "skip") {
			log.info("nothing to delete", { reason: retention.reason });
			return { success: true, processed: 0, errors, skipped: true };
		}

		try {
			const cutoff = new Date(
				Date.now() - retention.days * 24 * 60 * 60 * 1000,
			);
			const result = await deleteAuditLogsBefore(cutoff);
			return {
				success: true,
				processed: result.count,
				errors,
			};
		} catch (err) {
			errors.push(err instanceof Error ? err.message : String(err));
			return { success: false, processed: 0, errors };
		}
	},
};

type RetentionPolicy =
	| { kind: "delete"; days: number }
	| { kind: "skip"; reason: "unlimited-retention" | "feature-disabled" };

function getMaxAuditLogRetentionDays(): RetentionPolicy {
	let max: number | null = null;
	for (const planLimits of Object.values(LIMITS)) {
		const days = planLimits.auditLogDays;
		// "unlimited" on any plan means nothing may be deleted globally.
		if (days === "unlimited") {
			return { kind: "skip", reason: "unlimited-retention" };
		}
		if (typeof days === "number" && (max === null || days > max)) {
			max = days;
		}
	}
	// `false` on every plan = feature disabled catalog-wide, not a
	// zero-day retention promise — skip rather than purge.
	return max === null
		? { kind: "skip", reason: "feature-disabled" }
		: { kind: "delete", days: max };
}
