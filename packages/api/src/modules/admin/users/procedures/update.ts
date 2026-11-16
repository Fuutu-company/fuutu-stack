import { auth } from "@fuutu/auth";
import { isEmailTaken, revokeOAuthTokensForUser } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { systemAdminProcedure } from "../../../../orpc/procedures";
import { recordAdminAction } from "../../audit";
import {
	adminIdSchema,
	assertNotAdmin,
	assertNotSelf,
	loadTargetUser,
	reasonSchema,
	withAuthErrors,
} from "../../shared";

const updateUserInput = z
	.object({
		userId: adminIdSchema,
		name: z.string().trim().min(1).max(100).optional(),
		email: z.email().max(254).optional(),
		// Only ever unverify: "verified" needs proof of the mailbox
		// (`sendVerificationEmail`) — an admin's word would let a
		// pre-registered account absorb the owner's social sign-in.
		emailVerified: z.literal(false).optional(),
		reason: reasonSchema.optional(),
	})
	.refine((input) => !input.email || input.reason, {
		message: "A reason is required to change the email",
		path: ["reason"],
	});

type UserUpdate = { name?: string; email?: string; emailVerified?: boolean };

export const updateUserProcedure = systemAdminProcedure(PERMISSIONS.USER.UPDATE)
	.use(createRateLimitMiddleware({ endpoint: "adminMutation" }))
	.route({
		method: "PATCH",
		path: "/admin/users/{userId}",
		tags: ["Admin"],
		summary: "Update user",
		description:
			"Edit name or email, or mark the email unverified (to verify it, send a verification email). An email change requires a reason, leaves the new address unverified and signs the user out everywhere. Not for your own or another admin's email. System admin only.",
	})
	.input(updateUserInput)
	.handler(async ({ input, context }) => {
		const target = await loadTargetUser(input.userId);
		const data: UserUpdate = {};
		if (input.name !== undefined) data.name = input.name;
		if (input.emailVerified !== undefined) {
			data.emailVerified = input.emailVerified;
		}

		const email = input.email?.toLowerCase();
		const emailChanged =
			email !== undefined && email !== target.email.toLowerCase();
		if (emailChanged) {
			// Changing an admin's address + a reset mail = account takeover.
			assertNotSelf(
				context.user.id,
				target.id,
				"Change your own email in your account settings",
			);
			assertNotAdmin(
				target,
				"Admins cannot have their email changed. Demote them first.",
			);
			if (await isEmailTaken(email, target.id)) {
				throw new ORPCError("CONFLICT", {
					message: "Email is already in use",
				});
			}
			data.email = email;
			data.emailVerified = false;
		}

		const changedFields = Object.keys(data);
		if (changedFields.length === 0) {
			throw new ORPCError("BAD_REQUEST", { message: "Nothing to update" });
		}

		await withAuthErrors(() =>
			auth.api.adminUpdateUser({
				body: { userId: target.id, data },
				headers: context.headers,
			}),
		);
		if (emailChanged) {
			await withAuthErrors(() =>
				auth.api.revokeUserSessions({
					body: { userId: target.id },
					headers: context.headers,
				}),
			);
			await revokeOAuthTokensForUser(target.id);
		}

		await recordAdminAction(context, {
			action: "admin.user.update",
			targetUserId: target.id,
			reason: input.reason,
			changedFields,
		});
		return { success: true, changedFields };
	});
