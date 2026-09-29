import { updateUserProfile as updateUserProfileDb } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { dispatchEvent } from "@fuutu/webhooks";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import { protectedProcedure } from "../../../orpc/procedures";

const log = createLogger({ scope: "api:users" });

const updateProfileSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	image: z.string().url().optional(),
});

export const updateUserProfile = protectedProcedure
	.use(createRateLimitMiddleware({ endpoint: "userUpdate" }))
	.route({
		method: "PATCH",
		path: "/users/me",
		tags: ["Users"],
		summary: "Update user profile",
		description: "Update the current user's profile information",
	})
	.input(updateProfileSchema)
	.handler(async ({ context, input }) => {
		const updatedUser = await updateUserProfileDb(context.user.id, input);

		try {
			await dispatchEvent({
				event: "user.updated",
				userId: context.user.id,
				payload: { userId: context.user.id },
			});
		} catch (err) {
			log.warn("webhook dispatch failed", { err });
		}

		return {
			id: updatedUser.id,
			email: updatedUser.email,
			name: updatedUser.name,
			image: updatedUser.image,
			emailVerified: updatedUser.emailVerified,
			createdAt: updatedUser.createdAt,
		};
	});
