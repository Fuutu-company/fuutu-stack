import { getUnreadCount } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { permissionProcedure } from "../../../orpc";

export const getUnreadCountProcedure = permissionProcedure(
	PERMISSIONS.NOTIFICATION.VIEW,
)
	.route({
		method: "GET",
		path: "/notifications/unread-count",
		tags: ["Notifications"],
		summary: "Get unread count",
		description:
			"Returns the count of unread notifications for the current user.",
	})
	.handler(async ({ context }) => {
		const count = await getUnreadCount(context.user.id);
		return { count };
	});
