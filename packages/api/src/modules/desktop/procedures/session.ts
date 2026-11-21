import { auth } from "@fuutu/auth";
import { desktopOAuth } from "@fuutu/auth/desktop-oauth";
import {
	countDesktopDevices,
	getOrganizationWithMembers,
	getUserById,
	listOrganizationsForUser,
} from "@fuutu/db";
import { evaluateDesktopAccess } from "@fuutu/desktop/access";
import { desktopConfig } from "@fuutu/desktop/config";
import {
	type DesktopSession,
	desktopSessionSchema,
	offlineClaimAudience,
} from "@fuutu/desktop/session";
import { env } from "@fuutu/env/saas";
import { getUserEntitlement } from "@fuutu/payments";
import { paymentsConfig } from "@fuutu/payments/config";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import { authProcedure } from "../../../orpc/procedures";
import { assertDesktopCaller } from "../guards";

const DAY_MS = 86_400_000;

const inputSchema = z
	.object({
		/** Switch the app's organization; default: the token's sign-in org. */
		organizationId: z.string().min(1).optional(),
	})
	.optional();

type Org = { id: string; name: string; slug: string };

/** The org the session is for — a member's org or none (personal). */
async function resolveOrganization(
	userId: string,
	requested: string | undefined,
	fallback: string | null | undefined,
): Promise<Org | null> {
	for (const [orgId, explicit] of [
		[requested, true],
		[fallback, false],
	] as const) {
		if (!orgId) continue;
		const org = await getOrganizationWithMembers(orgId);
		if (org?.members.some((m) => m.userId === userId)) {
			return { id: org.id, name: org.name, slug: org.slug };
		}
		// An explicit switch to a foreign org fails; a stale sign-in org
		// (member since removed) silently falls back to personal.
		if (explicit) {
			throw new ORPCError("FORBIDDEN", { message: "Not a member" });
		}
	}
	return null;
}

function browserLinks(org: Org | null) {
	const saas = env.NEXT_PUBLIC_SAAS_URL ?? env.BETTER_AUTH_URL;
	const billing =
		org && paymentsConfig.billingAttachedTo === "organization"
			? `${saas}/organizations/${org.slug}/settings/billing`
			: `${saas}/settings/billing`;
	return {
		billing,
		account: `${saas}/settings`,
		devices: `${saas}/settings/desktop`,
	};
}

/**
 * The desktop app's view of its account: user, organization, plan,
 * entitlements, access (`desktopConfig.access`, trial, device limit),
 * the licensed major version and a signed offline-grace claim.
 * Works with a desktop access token and with a browser session.
 */
export const desktopSessionProcedure = authProcedure()
	.use(createRateLimitMiddleware({ maxRequests: 60, windowMs: 60_000 }))
	.route({
		method: "POST",
		path: "/desktop/session",
		tags: ["Desktop"],
		summary: "Desktop session",
		description:
			"Account, organization, plan, access and offline-grace claim for the desktop app.",
	})
	.input(inputSchema)
	.output(desktopSessionSchema)
	.handler(async ({ input, context }): Promise<DesktopSession> => {
		assertDesktopCaller(context);
		const userId = context.user.id;
		const [user, organizations] = await Promise.all([
			getUserById(userId),
			listOrganizationsForUser(userId),
		]);
		if (!user) throw new ORPCError("UNAUTHORIZED");
		const organization = await resolveOrganization(
			userId,
			input?.organizationId,
			context.desktop?.organizationId,
		);
		const entitlement = await getUserEntitlement(userId, {
			activeOrganizationId: organization?.id ?? null,
		});
		const deviceCount = await countDesktopDevices(
			userId,
			desktopOAuth.clientId,
		);
		const now = new Date();
		const access = evaluateDesktopAccess({
			requiredFeature: desktopConfig.access.requiredFeature,
			perMajorVersion: desktopConfig.access.perMajorVersion,
			majors: desktopConfig.access.majors,
			trialDays: desktopConfig.trial.days,
			deviceLimit: desktopConfig.devices.limit,
			features: entitlement.features,
			userCreatedAt: user.createdAt,
			deviceCount,
			now,
		});

		let offline: DesktopSession["offline"] = null;
		// Only the app needs the claim (a browser session never goes offline).
		if (
			context.desktop &&
			(access.status === "granted" || access.status === "trial")
		) {
			const graceEnd = now.getTime() + desktopConfig.offlineGraceDays * DAY_MS;
			const expiresAt = new Date(
				access.trialEndsAt
					? Math.min(graceEnd, access.trialEndsAt.getTime())
					: graceEnd,
			);
			const { token } = await auth.api.signJWT({
				body: {
					payload: {
						// Explicit: the app checks `iss` = backend origin.
						iss: desktopOAuth.issuer,
						sub: userId,
						aud: offlineClaimAudience(desktopOAuth.clientId),
						org: organization?.id ?? null,
						access: access.status,
						maxMajor: access.maxLicensedMajor,
						iat: Math.floor(now.getTime() / 1000),
						exp: Math.floor(expiresAt.getTime() / 1000),
					},
				},
			});
			offline = { token, expiresAt: expiresAt.toISOString() };
		}

		return {
			user: {
				id: user.id,
				name: user.name,
				email: user.email,
				image: user.image ?? null,
			},
			organization,
			organizations: organizations.map(({ id, name, slug }) => ({
				id,
				name,
				slug,
			})),
			plan: { id: entitlement.planId, tier: entitlement.tier },
			entitlements: entitlement.features,
			access: {
				status: access.status,
				trialEndsAt: access.trialEndsAt?.toISOString() ?? null,
				maxLicensedMajor: access.maxLicensedMajor,
			},
			devices: { count: deviceCount, limit: desktopConfig.devices.limit },
			offline,
			links: browserLinks(organization),
		};
	});
