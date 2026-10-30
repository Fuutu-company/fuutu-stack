import { pingTelemetry } from "@fuutu/telemetry";
import { cronConfig } from "../config";
import type { CronJob, CronJobResult } from "../types";

export const telemetryPingJob: CronJob = {
	name: "telemetry-ping",
	schedule: "0 * * * *",
	get enabled() {
		return cronConfig.jobs.telemetryPing;
	},
	async run(): Promise<CronJobResult> {
		const errors: string[] = [];
		try {
			const result = await pingTelemetry();
			if (!result.sent) {
				// FUUTU_TELEMETRY_DISABLED is a legitimate opt-out, not a
				// failure — record a skip so persisted run state does not
				// show a recurring hourly "error".
				if (result.reason === "disabled") {
					return { success: true, processed: 0, errors, skipped: true };
				}
				errors.push(`telemetry not sent: ${result.reason}`);
			}
			return {
				success: result.sent,
				processed: result.sent ? 1 : 0,
				errors,
			};
		} catch (err) {
			errors.push(err instanceof Error ? err.message : String(err));
			return { success: false, processed: 0, errors };
		}
	},
};
