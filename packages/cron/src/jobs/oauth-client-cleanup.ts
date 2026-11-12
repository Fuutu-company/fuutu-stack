import { deleteStaleUnownedOAuthClients } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { cronConfig } from "../config";
import type { CronJob, CronJobResult } from "../types";

const log = createLogger({ scope: "cron:oauth-client-cleanup" });

/** Unused registrations older than this are removed. */
const STALE_AFTER_DAYS = 7;

/**
 * Delete MCP OAuth clients from open dynamic client registration (no
 * owning user/org, not admin-trusted) that are older than 7 days and never
 * got a consent or a token. Registration is unauthenticated by design
 * (MCP clients register themselves), so abandoned or flooded registrations
 * would otherwise accumulate forever.
 */
export const oauthClientCleanupJob: CronJob = {
	name: "oauth-client-cleanup",
	schedule: "30 3 * * *",
	get enabled() {
		return cronConfig.jobs.oauthClientCleanup;
	},
	async run(): Promise<CronJobResult> {
		try {
			const cutoff = new Date(
				Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000,
			);
			const result = await deleteStaleUnownedOAuthClients(cutoff);
			if (result.count > 0) {
				log.info("deleted stale oauth clients", { count: result.count });
			}
			return { success: true, processed: result.count, errors: [] };
		} catch (err) {
			return {
				success: false,
				processed: 0,
				errors: [err instanceof Error ? err.message : String(err)],
			};
		}
	},
};
