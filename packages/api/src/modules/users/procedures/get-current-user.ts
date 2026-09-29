import type { UserWithRole } from "@fuutu/auth/types";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc";

export const getCurrentUser = protectedProcedure
	.route({
		method: "GET",
		path: "/users/me",
		tags: ["Users"],
		summary: "Get current user",
		description: "Returns the currently authenticated user's profile",
	})
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const user = context.user as UserWithRole;
		return {
			id: user.id,
			email: user.email,
			name: user.name,
			image: user.image ?? null,
			emailVerified: user.emailVerified ?? false,
			createdAt: user.createdAt ?? null,
		};
	});
