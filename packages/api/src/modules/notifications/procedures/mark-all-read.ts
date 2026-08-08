import { markAllRead } from "@fuutu/db";
import { createRateLimitMiddleware, protectedProcedure } from "../../../orpc";

export const markAllNotificationsReadProcedure = protectedProcedure
	.use(createRateLimitMiddleware({ endpoint: "notificationMutation" }))
	.route({
		method: "POST",
		path: "/notifications/read-all",
		tags: ["Notifications"],
		summary: "Mark all notifications as read",
		description: "Marks all unread notifications for the current user as read.",
	})
	.handler(async ({ context }) => {
		const result = await markAllRead(context.user.id);
		return { success: true, count: result.count };
	});
