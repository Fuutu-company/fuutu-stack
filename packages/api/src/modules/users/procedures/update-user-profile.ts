import { updateUserProfile as updateUserProfileDb } from "@fuutu/db";
import { z } from "zod";
import { createRateLimitMiddleware, protectedProcedure } from "../../../orpc";

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

		return {
			id: updatedUser.id,
			email: updatedUser.email,
			name: updatedUser.name,
			image: updatedUser.image,
			emailVerified: updatedUser.emailVerified,
			createdAt: updatedUser.createdAt,
		};
	});
