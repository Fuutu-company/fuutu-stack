import { countNotifications, listNotifications } from "@fuutu/db";
import { z } from "zod";
import { permissionProcedure } from "../../../orpc";

const listNotificationsSchema = z.object({
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(100).default(50),
});

export const listNotificationsProcedure = permissionProcedure(
	"view:notification",
)
	.route({
		method: "GET",
		path: "/notifications",
		tags: ["Notifications"],
		summary: "List notifications",
		description: "Returns paginated notifications for the current user.",
	})
	.input(listNotificationsSchema)
	.handler(async ({ input, context }) => {
		const skip = (input.page - 1) * input.limit;
		const [items, total] = await Promise.all([
			listNotifications(context.user.id, {
				take: input.limit,
				skip,
			}),
			countNotifications(context.user.id),
		]);
		return {
			items,
			page: input.page,
			limit: input.limit,
			total,
			totalPages: Math.max(1, Math.ceil(total / input.limit)),
		};
	});
