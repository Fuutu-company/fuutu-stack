import { createLogger } from "@fuutu/logs";
import { cronConfig } from "../config";
import type { CronJob, CronJobResult } from "../types";

const log = createLogger({ scope: "cron:seat-reconcile" });

/**
 * Re-sync the billed seats of every seat-based organization subscription
 * with its member count (`reconcileOrganizationSeats`) — catches a seat
 * sync that failed in the membership hooks (provider down) and checkouts
 * with fewer seats than members. Failed organizations fail the run and
 * are retried the next day.
 */
export const seatReconcileJob: CronJob = {
	name: "seat-reconcile",
	schedule: "15 4 * * *",
	get enabled() {
		return cronConfig.jobs.seatReconcile;
	},
	async run(): Promise<CronJobResult> {
		try {
			// Loaded on run: the payments package pulls in every provider SDK.
			const { reconcileOrganizationSeats } = await import("@fuutu/payments");
			const result = await reconcileOrganizationSeats();
			if (result.synced > 0 || result.failed > 0) {
				log.info("reconciled organization seats", result);
			}
			return {
				success: result.failed === 0,
				processed: result.synced,
				errors:
					result.failed > 0
						? [`${result.failed} organization seat sync(s) failed`]
						: [],
			};
		} catch (err) {
			return {
				success: false,
				processed: 0,
				errors: [err instanceof Error ? err.message : String(err)],
			};
		}
	},
};
