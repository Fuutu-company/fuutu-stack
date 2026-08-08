import { deleteAuditLogsBefore } from "@fuutu/db";
import { LIMITS } from "@fuutu/payments/config";
import { cronConfig } from "../config";
import type { CronJob, CronJobResult } from "../types";

/**
 * Delete audit logs older than the maximum retention across all plans.
 *
 * Uses the highest finite `auditLogDays` value from LIMITS. Plans with
 * `false` (no audit logs) or `"unlimited"` are skipped.
 */
export const auditLogCleanupJob: CronJob = {
	name: "audit-log-cleanup",
	schedule: "0 3 * * *",
	enabled: cronConfig.jobs.auditLogCleanup,
	async run(): Promise<CronJobResult> {
		const errors: string[] = [];
		const retentionDays = getMaxAuditLogRetentionDays();

		if (retentionDays === null) {
			return { success: true, processed: 0, errors };
		}

		try {
			const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
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

function getMaxAuditLogRetentionDays(): number | null {
	let max: number | null = null;
	for (const planLimits of Object.values(LIMITS)) {
		const days = planLimits.auditLogDays;
		if (typeof days === "number" && (max === null || days > max)) {
			max = days;
		}
	}
	return max;
}
