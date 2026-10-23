import { db } from "../client";

/** Prisma unique-violation error code (same pattern as credit-balance.ts). */
const isUniqueViolation = (err: unknown): boolean =>
	err instanceof Error && "code" in err && err.code === "P2002";

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

export const recordCronJobRun = (
	jobKey: string,
	status: "success" | "error" | "skipped",
	runAt: Date,
	error?: string,
) =>
	db.cronJobRun.upsert({
		where: { jobKey },
		create: {
			jobKey,
			lastRunAt: runAt,
			lastStatus: status,
			lastError: error ?? null,
		},
		update: {
			lastRunAt: runAt,
			lastStatus: status,
			lastError: error ?? null,
		},
	});
