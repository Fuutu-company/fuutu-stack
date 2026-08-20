import { createLogger } from "@fuutu/logs";
import { auditLogCleanupJob } from "../jobs/audit-log-cleanup";
import { subscriptionReminderJob } from "../jobs/subscription-reminder";
import { telemetryPingJob } from "../jobs/telemetry-ping";
import { webhookRetryJob } from "../jobs/webhook-retry";
import type { CronJob, CronJobResult, JobRunner } from "../types";

const log = createLogger({ scope: "cron:inline" });

const jobs: CronJob[] = [
	webhookRetryJob,
	auditLogCleanupJob,
	subscriptionReminderJob,
	telemetryPingJob,
];

/**
 * Inline job runner — runs jobs in-process.
 *
 * Default runner, suitable for dev and self-hosted single-instance deploys.
 * For multi-instance or managed-scheduler setups, swap to a
 * `TriggerDevJobRunner` (or similar) via `cronConfig.runner`.
 */
export class InlineJobRunner implements JobRunner {
	readonly id = "inline";

	async run(name: string): Promise<CronJobResult> {
		const job = jobs.find((j) => j.name === name);
		if (!job) {
			return {
				success: false,
				processed: 0,
				errors: [`unknown job "${name}"`],
			};
		}
		if (!job.enabled) {
			log.info(`job "${name}" is disabled, skipping.`);
			return { success: true, processed: 0, errors: [] };
		}
		return job.run();
	}

	async runAll(): Promise<Record<string, CronJobResult>> {
		const results: Record<string, CronJobResult> = {};
		for (const job of jobs) {
			if (!job.enabled) {
				results[job.name] = { success: true, processed: 0, errors: [] };
				continue;
			}
			results[job.name] = await job.run();
		}
		return results;
	}

	list(): CronJob[] {
		return jobs;
	}
}
