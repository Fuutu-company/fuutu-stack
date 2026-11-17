import { isOwnUserImage } from "@fuutu/auth/hooks/profile-input";
import { updateUserProfile as updateUserProfileDb } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { dispatchEvent } from "@fuutu/webhooks";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import {
	denyImpersonation,
	protectedProcedure,
} from "../../../orpc/procedures";

const log = createLogger({ scope: "api:users" });

const updateProfileSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	image: z.string().max(2048).nullable().optional(),
});

export const updateUserProfile = protectedProcedure
	.use(denyImpersonation)
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
		if (input.image != null && !isOwnUserImage(input.image, context.user.id)) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Image must be one of your own uploads",
			});
		}
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
