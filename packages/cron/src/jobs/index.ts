import { createLogger } from "@fuutu/logs";
import { appJobs } from "../app-jobs";
import { parseCronExpression } from "../schedule";
import type { CronJob } from "../types";
import { auditLogCleanupJob } from "./audit-log-cleanup";
import { oauthClientCleanupJob } from "./oauth-client-cleanup";
import { subscriptionReminderJob } from "./subscription-reminder";
import { telemetryPingJob } from "./telemetry-ping";
import { webhookRetryJob } from "./webhook-retry";

export { auditLogCleanupJob } from "./audit-log-cleanup";
export { oauthClientCleanupJob } from "./oauth-client-cleanup";
export { subscriptionReminderJob } from "./subscription-reminder";
export { telemetryPingJob } from "./telemetry-ping";
export { webhookRetryJob } from "./webhook-retry";

const log = createLogger({ scope: "cron" });

const BUILT_IN_JOBS: readonly CronJob[] = [
	webhookRetryJob,
	auditLogCleanupJob,
	subscriptionReminderJob,
	telemetryPingJob,
	oauthClientCleanupJob,
];

// State lives on `globalThis` (not module scope): Next.js may evaluate
// this module once per bundle (instrumentation, the /api/cron route), and
// a job registered in one bundle must be visible to the runner in all of
// them. Seeded once — later bundle loads keep earlier registrations and
// overrides instead of re-adding built-ins.
const REGISTRY_KEY = Symbol.for("fuutu.cron.jobs");

const scope = globalThis as typeof globalThis & {
	[REGISTRY_KEY]?: CronJob[];
};
const seeded = scope[REGISTRY_KEY] !== undefined;
scope[REGISTRY_KEY] ??= [...BUILT_IN_JOBS];

/** The registered job registry — single source of truth for all runners. */
export const allJobs: CronJob[] = scope[REGISTRY_KEY];

/**
 * Register a job at runtime — the extension point for kit consumers.
 * Call before the first run (e.g. in Next.js `instrumentation.ts`
 * `register()`); runners hold a live reference to `allJobs`, so the job
 * is picked up without restarting the runner.
 *
 * Idempotent by name: registering a job whose `name` already exists
 * replaces the previous entry (last registration wins), which also lets
 * consumers deliberately override a built-in job. Replacing stays
 * allowed but logs a `warn` — a silent override makes a missing job
 * hard to diagnose.
 *
 * `job.schedule` is validated via `parseCronExpression`: an invalid
 * expression logs an `error` naming the job but still registers —
 * consistent with the built-in fail-open policy (a bad schedule
 * degrades to run-every-trigger, loud rather than fatal). This matters
 * for jobs registered after runner construction, which miss the
 * runner's own startup validation.
 */
export function registerJob(job: CronJob): void {
	try {
		parseCronExpression(job.schedule);
	} catch (error) {
		log.error("invalid cron schedule — job will run on every trigger", {
			job: job.name,
			schedule: job.schedule,
			err: error,
		});
	}
	const existing = allJobs.findIndex((j) => j.name === job.name);
	if (existing >= 0) {
		log.warn("registerJob replacing existing job", { job: job.name });
		allJobs[existing] = job;
		return;
	}
	allJobs.push(job);
}

// App-owned jobs (../app-jobs.ts) join the registry when it is seeded.
if (!seeded) for (const job of appJobs) registerJob(job);
