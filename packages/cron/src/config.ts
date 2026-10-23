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
	/**
	 * Per-job enable flags. The four keys cover the built-in jobs; the
	 * index signature lets jobs added via `registerJob` opt into the same
	 * mechanism (`get enabled() { return cronConfig.jobs["my-job"] ?? true; }`).
	 * Unset keys mean "enabled" — a job's own `enabled` field is the default.
	 */
	jobs: {
		webhookRetry: boolean;
		auditLogCleanup: boolean;
		subscriptionReminder: boolean;
		telemetryPing: boolean;
		[customJob: string]: boolean | undefined;
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
