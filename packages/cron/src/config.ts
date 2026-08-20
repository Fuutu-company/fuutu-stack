import { env } from "@fuutu/env/saas";
import type { JobRunnerId } from "./types";

/**
 * Cron configuration — owned by @fuutu/cron.
 *
 * Provider selection is env-driven: `CRON_PROVIDER` picks the active runner.
 * The default `inline` runner executes jobs in-process; `trigger-dev` is a
 * skeleton for managed-scheduler setups.
 */
export interface CronConfig {
	runner: JobRunnerId;
	jobs: {
		webhookRetry: boolean;
		auditLogCleanup: boolean;
		subscriptionReminder: boolean;
		telemetryPing: boolean;
	};
}

export const cronConfig: CronConfig = {
	get runner(): JobRunnerId {
		return env.CRON_PROVIDER ?? "inline";
	},
	jobs: {
		webhookRetry: true,
		auditLogCleanup: true,
		subscriptionReminder: true,
		telemetryPing: true,
	},
};
