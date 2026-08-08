import { listAuditLogs } from "@fuutu/db";
import { protectedProcedure } from "../../../orpc";

/**
 * Recent activity feed for the dashboard.
 * Returns the last 10 audit-log entries for the current user.
 */
export const listRecentActivityProcedure = protectedProcedure
	.route({
		method: "GET",
		path: "/activity/recent",
		tags: ["Activity"],
		summary: "Recent activity",
		description: "Last 10 audit-log entries for the current user.",
	})
	.handler(async ({ context }) => {
		const userId = context.user.id;
		const items = await listAuditLogs({ userId, take: 10, skip: 0 });
		return { items };
	});
