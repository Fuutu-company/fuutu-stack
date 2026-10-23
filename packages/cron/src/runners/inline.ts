import { claimCronJobRun, getCronJobRun, recordCronJobRun } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { allJobs } from "../jobs";
import { isJobDue, parseCronExpression } from "../schedule";
import type { CronJob, CronJobResult, JobRunner } from "../types";

const log = createLogger({ scope: "cron:inline" });

/**
 * Bound on a single job's execution time. A hung job must not block the
 * rest of the run — past this it is reported as failed. The underlying
 * promise is not cancelled (JS cannot cancel a pending promise); it still
 * settles in the background, only the runner moves on.
 */
const JOB_TIMEOUT_MS = 5 * 60_000;

/**
 * Inline job runner — runs jobs in-process.
 *
 * Default runner, suitable for dev and self-hosted single-instance deploys.
 * For multi-instance or managed-scheduler setups, swap to a
 * `TriggerDevJobRunner` (or similar) via `cronConfig.runner`.
 *
 * `runAll()` honors each job's `schedule`: a job runs only when its cron
 * expression has a scheduled slot newer than the persisted `lastRunAt`
 * (`app.cron_job_run` table). Due jobs are claimed atomically via
 * `claimCronJobRun` before executing, so overlapping triggers or a
 * multi-instance deploy cannot run the same slot twice. `run(name)` is
 * the force-run path — it ignores schedule and claim. Both record the
 * outcome via `recordCronJobRun`.
 *
 * A per-job in-flight guard blocks overlapping executions within this
 * process (which the DB claim cannot see): while a job is running,
 * `run` returns an "already running" failure and `runAll` reports it
 * `skipped`. The guard lifts only when the job's promise settles — a
 * job that hits the timeout keeps blocking overlaps until it finishes
 * in the background.
 */
export class InlineJobRunner implements JobRunner {
	readonly id = "inline";

	private readonly inFlight = new Set<string>();

	constructor(private readonly jobs: CronJob[] = allJobs) {
		// `isJobDue` fails open on unparseable schedules (a typo degrades to
		// run-every-trigger rather than silently disabling the job), so bad
		// expressions are surfaced loudly once per process at construction.
		for (const job of jobs) {
			try {
				parseCronExpression(job.schedule);
			} catch (error) {
				log.error("invalid cron schedule — job will run on every trigger", {
					job: job.name,
					schedule: job.schedule,
					err: error,
				});
			}
		}
	}

	async run(name: string): Promise<CronJobResult> {
		const job = this.jobs.find((j) => j.name === name);
		if (!job) {
			return {
				success: false,
				processed: 0,
				errors: [`unknown job "${name}"`],
			};
		}
		if (this.inFlight.has(name)) {
			return {
				success: false,
				processed: 0,
				errors: [`job "${name}" is already running`],
			};
		}
		if (!job.enabled) {
			log.info("job is disabled — skipping force-run", { job: name });
			return {
				success: false,
				processed: 0,
				errors: [`job "${name}" is disabled`],
			};
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
			if (this.inFlight.has(job.name)) {
				results[job.name] = {
					success: true,
					processed: 0,
					errors: [],
					skipped: true,
				};
				continue;
			}
			const lastRunAt = await this.getLastRunAt(job.name);
			if (!isJobDue(job.schedule, lastRunAt, now)) {
				results[job.name] = { success: true, processed: 0, errors: [] };
				continue;
			}
			const claimedAt = await this.claim(job.name, lastRunAt);
			if (claimedAt === null) {
				// A concurrent trigger/instance claimed the slot first,
				// or the claim write itself failed (fail-closed).
				results[job.name] = {
					success: true,
					processed: 0,
					errors: [],
					skipped: true,
				};
				continue;
			}
			results[job.name] = await this.execute(job, claimedAt);
		}
		return results;
	}

	list(): CronJob[] {
		return this.jobs;
	}

	/**
	 * Run bookkeeping state lives in the DB; when it is unreadable (e.g.
	 * migration not applied yet) we fail open and run the job rather than
	 * silently disabling all scheduling. `undefined` marks the unreadable
	 * case so `claim` can skip the lock (there is nothing to claim
	 * against) while `null` is a legitimately missing row.
	 */
	private async getLastRunAt(jobKey: string): Promise<Date | null | undefined> {
		try {
			const run = await getCronJobRun(jobKey);
			return run?.lastRunAt ?? null;
		} catch (error) {
			log.warn("could not read run state", { job: jobKey, err: error });
			return undefined;
		}
	}

	/**
	 * Dedupes concurrent triggers via an atomic conditional write
	 * (`claimCronJobRun`). Two failure modes, opposite policies: fail
	 * open when the run state was unreadable (`expectedLastRunAt ===
	 * undefined` — there is nothing to claim against, consistent with
	 * `getLastRunAt`), fail closed when the claim write itself errors —
	 * a failed write means a degraded DB, and running every job
	 * unclaimed on every instance would multiply the harm.
	 */
	/**
	 * Returns the claim timestamp (`lastRunAt` value the claim wrote)
	 * when the slot was won, `undefined` when the run proceeds unclaimed
	 * (unreadable run state — nothing to claim against), or `null` when
	 * the claim was lost or failed and the job must be skipped.
	 */
	private async claim(
		jobKey: string,
		expectedLastRunAt: Date | null | undefined,
	): Promise<Date | null | undefined> {
		if (expectedLastRunAt === undefined) {
			return undefined;
		}
		try {
			const claimedAt = new Date();
			const won = await claimCronJobRun(jobKey, expectedLastRunAt, claimedAt);
			return won ? claimedAt : null;
		} catch (error) {
			log.warn("could not claim run slot — skipping", {
				job: jobKey,
				err: error,
			});
			return null;
		}
	}

	private async execute(
		job: CronJob,
		claimedAt?: Date,
	): Promise<CronJobResult> {
		this.inFlight.add(job.name);
		let result: CronJobResult;
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			// Promise.resolve().then normalizes a synchronous throw into a
			// rejection, so `p` is always a real promise.
			const p = Promise.resolve().then(() => job.run());
			// The guard lifts when the job's own promise settles — not when
			// the race times out — so a zombie execution still blocks
			// overlapping runs. The trailing catch silences the derived
			// promise; it never swallows `p` itself.
			void p.finally(() => this.inFlight.delete(job.name)).catch(() => {});
			result = await Promise.race([
				p,
				new Promise<never>((_, reject) => {
					timer = setTimeout(
						() => reject(new Error(`timed out after ${JOB_TIMEOUT_MS}ms`)),
						JOB_TIMEOUT_MS,
					);
				}),
			]);
		} catch (error) {
			// A crashing or timed-out job must not prevent the remaining jobs
			// from running — report it and continue.
			log.error("job threw", { job: job.name, err: error });
			result = {
				success: false,
				processed: 0,
				errors: [error instanceof Error ? error.message : String(error)],
			};
		} finally {
			clearTimeout(timer);
		}
		try {
			// `claimedAt` ties the record write to this run's claim — a
			// stale finisher whose slot was re-claimed cannot overwrite the
			// newer run's state. Force-runs pass no claim and take the
			// unconditional upsert path inside recordCronJobRun.
			await recordCronJobRun(
				job.name,
				result.skipped ? "skipped" : result.success ? "success" : "error",
				new Date(),
				result.errors[0],
				claimedAt,
			);
		} catch (error) {
			// Recording is best-effort — a missed write only means the job may
			// run again on the next trigger, which is safer than crashing the
			// run over bookkeeping.
			log.warn("could not record run state", { job: job.name, err: error });
		}
		return result;
	}
}
