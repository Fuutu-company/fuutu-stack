import { markAllRead } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { createRateLimitMiddleware, permissionProcedure } from "../../../orpc";

export const markAllNotificationsReadProcedure = permissionProcedure(
	PERMISSIONS.NOTIFICATION.UPDATE,
)
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
