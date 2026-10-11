import { db } from "../client";

export const getCronJobRun = (jobKey: string) =>
	db.cronJobRun.findUnique({ where: { jobKey } });

export const recordCronJobRun = (
	jobKey: string,
	status: "success" | "error",
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
