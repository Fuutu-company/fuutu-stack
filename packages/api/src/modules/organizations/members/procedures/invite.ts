import { auth } from "@fuutu/auth";
import { createLogger } from "@fuutu/logs";
import { hasRoleAtLeast, PERMISSIONS, toOrgRole } from "@fuutu/rbac";
import { dispatchEvent } from "@fuutu/webhooks";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../../orpc/middleware/rate-limit";
import { authProcedure } from "../../../../orpc/procedures";
import { toSeatLimitError } from "../../seat-limit-error";

const log = createLogger({ scope: "api:organizations" });

const inviteMemberSchema = z.object({
	organizationId: z.string().min(1),
	email: z.string().email(),
	role: z.enum(["owner", "admin", "member"]).default("member"),
});

// No `limit` pre-flight: the seat cap is enforced by the auth
// organizationHooks against Entitlement.seatsTotal (members + pending
// invitations) and surfaced below as a typed PAYMENT_REQUIRED error.
export const inviteMember = authProcedure({
	org: { permission: PERMISSIONS.INVITE_MEMBER },
})
	.use(createRateLimitMiddleware({ endpoint: "organizationMember" }))
	.route({
		method: "POST",
		path: "/organizations/{organizationId}/members/invite",
		tags: ["Organizations"],
		summary: "Invite member",
		description:
			"Sends an invitation to join the organization. Admin role required. Can only invite at or below your own role level (owner can invite owner; admin can invite admin/member).",
	})
	.input(inviteMemberSchema)
	.handler(async ({ input, context }) => {
		const actorRole = context.orgRole ?? "member";
		const targetRole = toOrgRole(input.role);
		if (!hasRoleAtLeast(actorRole, targetRole)) {
			throw new ORPCError("FORBIDDEN", {
				message: "Cannot invite a member with a higher role than your own",
			});
		}
		let invitation: Awaited<ReturnType<typeof auth.api.createInvitation>>;
		try {
			invitation = await auth.api.createInvitation({
				body: {
					email: input.email,
					role: input.role,
					organizationId: input.organizationId,
				},
				headers: context.headers,
			});
		} catch (e) {
			throw toSeatLimitError(e) ?? e;
		}
		try {
			await dispatchEvent({
				event: "member.invited",
				organizationId: input.organizationId,
				userId: context.user.id,
				payload: {
					organizationId: input.organizationId,
					email: input.email,
					role: input.role,
				},
			});
		} catch (err) {
			log.warn("webhook dispatch failed", { err });
		}
		return invitation;
	});
