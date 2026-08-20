/**
 * @fuutu/cron — scheduled job runner types.
 *
 * The `JobRunner` interface abstracts *how* jobs are scheduled and invoked.
 * The default `InlineJobRunner` runs jobs in-process (suitable for dev and
 * self-hosted single-instance deploys). A `TriggerDevJobRunner` (skeleton)
 * shows the swap point for managed schedulers like Trigger.dev.
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

/**
 * Abstraction over the job execution backend.
 *
 * `run(name)` invokes a single registered job. `runAll()` invokes every
 * enabled job. Implementations may delegate to an external scheduler
 * (Trigger.dev, Inngest, …) instead of running in-process.
 */
export interface JobRunner {
	readonly id: string;
	run(name: string): Promise<CronJobResult>;
	runAll(): Promise<Record<string, CronJobResult>>;
	list(): CronJob[];
}

export type JobRunnerId = "inline" | "trigger-dev";
