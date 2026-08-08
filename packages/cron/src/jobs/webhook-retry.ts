import { processPendingDeliveries } from "@fuutu/webhooks";
import { cronConfig } from "../config";
import type { CronJob, CronJobResult } from "../types";

export const webhookRetryJob: CronJob = {
	name: "webhook-retry",
	schedule: "*/5 * * * *",
	enabled: cronConfig.jobs.webhookRetry,
	async run(): Promise<CronJobResult> {
		const errors: string[] = [];
		try {
			const result = await processPendingDeliveries();
			return {
				success: true,
				processed: result.processed,
				errors,
			};
		} catch (err) {
			errors.push(err instanceof Error ? err.message : String(err));
			return { success: false, processed: 0, errors };
		}
	},
};
