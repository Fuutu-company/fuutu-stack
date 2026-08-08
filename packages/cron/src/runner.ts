import { createLogger } from "@fuutu/logs";
import { auditLogCleanupJob } from "./jobs/audit-log-cleanup";
import { subscriptionReminderJob } from "./jobs/subscription-reminder";
import { telemetryPingJob } from "./jobs/telemetry-ping";
import { webhookRetryJob } from "./jobs/webhook-retry";
import type { CronJob, CronJobResult } from "./types";

const log = createLogger({ scope: "cron:runner" });

const jobs: CronJob[] = [
	webhookRetryJob,
	auditLogCleanupJob,
	subscriptionReminderJob,
	telemetryPingJob,
];

/**
 * Run a specific job by name.
 */
export async function runJob(name: string): Promise<CronJobResult> {
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

/**
 * Run all enabled jobs sequentially.
 */
export async function runAllJobs(): Promise<Record<string, CronJobResult>> {
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

export function listJobs(): CronJob[] {
	return jobs;
}
