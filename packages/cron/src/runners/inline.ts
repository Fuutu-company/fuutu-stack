import { getCronJobRun, recordCronJobRun } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { allJobs } from "../jobs";
import { isJobDue } from "../schedule";
import type { CronJob, CronJobResult, JobRunner } from "../types";

const log = createLogger({ scope: "cron:inline" });

/**
 * Inline job runner — runs jobs in-process.
 *
 * Default runner, suitable for dev and self-hosted single-instance deploys.
 * For multi-instance or managed-scheduler setups, swap to a
 * `TriggerDevJobRunner` (or similar) via `cronConfig.runner`.
 *
 * `runAll()` honors each job's `schedule`: a job runs only when its cron
 * expression has a scheduled slot newer than the persisted `lastRunAt`
 * (`app.cron_job_run` table). `run(name)` is the force-run path — it ignores
 * the schedule. Both record the outcome via `recordCronJobRun`.
 */
export class InlineJobRunner implements JobRunner {
	readonly id = "inline";

	constructor(private readonly jobs: CronJob[] = allJobs) {}

	async run(name: string): Promise<CronJobResult> {
		const job = this.jobs.find((j) => j.name === name);
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
		return this.execute(job);
	}

	async runAll(): Promise<Record<string, CronJobResult>> {
		const results: Record<string, CronJobResult> = {};
		const now = new Date();
		for (const job of this.jobs) {
			if (!job.enabled) {
				results[job.name] = { success: true, processed: 0, errors: [] };
				continue;
			}
			const lastRunAt = await this.getLastRunAt(job.name);
			if (!isJobDue(job.schedule, lastRunAt, now)) {
				results[job.name] = { success: true, processed: 0, errors: [] };
				continue;
			}
			results[job.name] = await this.execute(job);
		}
		return results;
	}

	list(): CronJob[] {
		return this.jobs;
	}

	/**
	 * Run bookkeeping state lives in the DB; when it is unreadable (e.g.
	 * migration not applied yet) we fail open and run the job rather than
	 * silently disabling all scheduling.
	 */
	private async getLastRunAt(jobKey: string): Promise<Date | null> {
		try {
			const run = await getCronJobRun(jobKey);
			return run?.lastRunAt ?? null;
		} catch (error) {
			log.warn(`could not read run state for job "${jobKey}"`, {
				err: error,
			});
			return null;
		}
	}

	private async execute(job: CronJob): Promise<CronJobResult> {
		let result: CronJobResult;
		try {
			result = await job.run();
		} catch (error) {
			// A crashing job must not prevent the remaining jobs from
			// running — report it and continue.
			log.error(`job "${job.name}" threw`, { err: error });
			result = {
				success: false,
				processed: 0,
				errors: [error instanceof Error ? error.message : String(error)],
			};
		}
		try {
			await recordCronJobRun(
				job.name,
				result.success ? "success" : "error",
				new Date(),
				result.errors[0],
			);
		} catch (error) {
			log.warn(`could not record run state for job "${job.name}"`, {
				err: error,
			});
		}
		return result;
	}
}
