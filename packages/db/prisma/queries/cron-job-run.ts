import { db } from "../client";
import { isUniqueViolation } from "./transaction";

export const getCronJobRun = (jobKey: string) =>
	db.cronJobRun.findUnique({ where: { jobKey } });

/**
 * Atomically claim a scheduled run for `jobKey` so concurrent triggers
 * (overlapping /api/cron hits or multi-instance deploys) cannot run the
 * same slot twice.
 *
 * `expectedLastRunAt` is the value the caller just observed:
 * - a Date → conditional `updateMany` guarded by that value; the update
 *   only lands when nobody else advanced `lastRunAt` in between.
 * - `null` (no row observed) → plain `create`; the `jobKey` unique
 *   constraint decides the winner, a P2002 means someone else claimed.
 *
 * Claiming advances `lastRunAt` immediately — a crashed execution
 * forfeits the slot (at-most-once semantics), matching the "no catch-up"
 * policy of the scheduler. `recordCronJobRun` writes the real status when
 * the job finishes.
 */
export const claimCronJobRun = async (
	jobKey: string,
	expectedLastRunAt: Date | null,
	claimedAt: Date,
): Promise<boolean> => {
	if (expectedLastRunAt === null) {
		try {
			await db.cronJobRun.create({
				data: { jobKey, lastRunAt: claimedAt, lastStatus: "running" },
			});
			return true;
		} catch (err) {
			if (isUniqueViolation(err)) {
				return false;
			}
			throw err;
		}
	}
	const { count } = await db.cronJobRun.updateMany({
		where: { jobKey, lastRunAt: expectedLastRunAt },
		data: { lastRunAt: claimedAt, lastStatus: "running" },
	});
	return count === 1;
};

/**
 * Record a finished run.
 *
 * When `claimedAt` is provided (the timestamp `claimCronJobRun` stamped
 * into `lastRunAt`), the write is a conditional `updateMany` guarded by
 * that value — a finisher whose claim was superseded by a newer claim
 * updates 0 rows and is silently dropped instead of clobbering the
 * newer run's bookkeeping. Without `claimedAt` (force-run path, no
 * claim) it falls back to an unconditional upsert.
 */
export const recordCronJobRun = async (
	jobKey: string,
	status: "success" | "error" | "skipped",
	runAt: Date,
	error?: string,
	claimedAt?: Date,
) => {
	const data = {
		lastRunAt: runAt,
		lastStatus: status,
		lastError: error ?? null,
	};
	if (claimedAt) {
		await db.cronJobRun.updateMany({
			where: { jobKey, lastRunAt: claimedAt },
			data,
		});
		return;
	}
	// Fail-open: an unclaimed (force-run) write may overwrite another
	// instance's in-flight record — documented policy for this path.
	await db.cronJobRun.upsert({
		where: { jobKey },
		create: { jobKey, ...data },
		update: data,
	});
};
