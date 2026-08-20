import { markRead } from "@fuutu/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware, permissionProcedure } from "../../../orpc";

const markReadSchema = z.object({
	id: z.string().min(1),
});

export const markNotificationReadProcedure = permissionProcedure(
	"update:notification",
)
	.use(createRateLimitMiddleware({ endpoint: "notificationMutation" }))
	.route({
		method: "POST",
		path: "/notifications/{id}/read",
		tags: ["Notifications"],
		summary: "Mark notification as read",
		description:
			"Marks a single notification as read. Only the owner can mark it.",
	})
	.input(markReadSchema)
	.handler(async ({ input, context }) => {
		const result = await markRead(input.id, context.user.id);
		if (!result) {
			throw new ORPCError("NOT_FOUND", { message: "Notification not found" });
		}
		return { success: true };
	});
