import { createLogger } from "@fuutu/logs";
import { auditLogCleanupJob } from "../jobs/audit-log-cleanup";
import { subscriptionReminderJob } from "../jobs/subscription-reminder";
import { telemetryPingJob } from "../jobs/telemetry-ping";
import { webhookRetryJob } from "../jobs/webhook-retry";
import type { CronJob, CronJobResult, JobRunner } from "../types";

const log = createLogger({ scope: "cron:trigger-dev" });

const jobs: CronJob[] = [
	webhookRetryJob,
	auditLogCleanupJob,
	subscriptionReminderJob,
	telemetryPingJob,
];

/**
 * Trigger.dev job runner — skeleton (inactive in v1).
 *
 * Delegates job execution to Trigger.dev's managed scheduler. To activate:
 * 1. Install `@trigger.dev/sdk` and `@trigger.dev/build`
 * 2. Register each `CronJob` as a Trigger.dev task with its cron schedule
 * 3. Set `CRON_PROVIDER=trigger-dev` and the required Trigger.dev env vars
 * 4. Replace the throw stubs below with `io.runTask(...)` calls
 *
 * The job definitions (names, schedules, run logic) stay in `jobs/` — only
 * the execution backend changes.
 */
export class TriggerDevJobRunner implements JobRunner {
	readonly id = "trigger-dev";

	async run(_name: string): Promise<CronJobResult> {
		throw new Error(
			"Trigger.dev runner not implemented. Set CRON_PROVIDER=inline to use the active runner.",
		);
	}

	async runAll(): Promise<Record<string, CronJobResult>> {
		throw new Error(
			"Trigger.dev runner not implemented. Set CRON_PROVIDER=inline to use the active runner.",
		);
	}

	list(): CronJob[] {
		return jobs;
	}
}
