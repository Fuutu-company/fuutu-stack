/**
 * @fuutu/cron — scheduled job runner types.
 */

export interface CronJobResult {
	success: boolean;
	processed: number;
	errors: string[];
}

export interface CronJob {
	readonly name: string;
	/** Cron expression describing the intended cadence. Metadata only — the runner is triggered externally (e.g. via a scheduler or `runJob`/`runAllJobs`), not by an internal timer. */
	readonly schedule: string;
	readonly enabled: boolean;
	run(): Promise<CronJobResult>;
}
