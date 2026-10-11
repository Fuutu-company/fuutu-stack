import type { CronJob } from "../types";
import { auditLogCleanupJob } from "./audit-log-cleanup";
import { subscriptionReminderJob } from "./subscription-reminder";
import { telemetryPingJob } from "./telemetry-ping";
import { webhookRetryJob } from "./webhook-retry";

export { auditLogCleanupJob } from "./audit-log-cleanup";
export { subscriptionReminderJob } from "./subscription-reminder";
export { telemetryPingJob } from "./telemetry-ping";
export { webhookRetryJob } from "./webhook-retry";

/** The registered job registry — single source of truth for all runners. */
export const allJobs: CronJob[] = [
	webhookRetryJob,
	auditLogCleanupJob,
	subscriptionReminderJob,
	telemetryPingJob,
];
