import { config, KIT_VERSION } from "@fuutu/config";
import { APP_VERSION } from "@fuutu/config/app-version";
import { allJobs } from "@fuutu/cron";
import { getCronJobRun, pingDatabase } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { systemAdminProcedure } from "../../../../orpc/procedures";
import { getProviderStatuses } from "../providers";

/** Feature flags as booleans and strings — anything richer is not a flag. */
function readFeatureFlags(): { key: string; value: boolean | string }[] {
	return Object.entries(config.features).flatMap(([key, value]) =>
		typeof value === "boolean" || typeof value === "string"
			? [{ key, value }]
			: [],
	);
}

export const systemStatusProcedure = systemAdminProcedure(
	PERMISSIONS.VIEW_ADMIN,
)
	.use(createRateLimitMiddleware({ endpoint: "adminRead" }))
	.route({
		method: "GET",
		path: "/admin/system/status",
		tags: ["Admin"],
		summary: "System status",
		description:
			"Read-only snapshot: database reachability and latency, the active provider per swappable domain (name and configured flag only, never credentials), scheduled jobs with their last run, feature flags and the app and kit versions. System admin only.",
	})
	.handler(async () => {
		const [database, cron] = await Promise.all([
			pingDatabase(),
			Promise.all(
				allJobs.map(async (job) => {
					const run = await getCronJobRun(job.name);
					return {
						key: job.name,
						schedule: job.schedule,
						enabled: job.enabled,
						lastRunAt: run?.lastRunAt ?? null,
						lastStatus: run?.lastStatus ?? null,
					};
				}),
			),
		]);
		return {
			database,
			providers: getProviderStatuses(),
			cron,
			features: readFeatureFlags(),
			versions: { app: APP_VERSION, kit: KIT_VERSION },
		};
	});
