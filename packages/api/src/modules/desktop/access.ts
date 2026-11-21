import { desktopOAuth } from "@fuutu/auth/desktop-oauth";
import { countDesktopDevices, getOrganizationWithMembers } from "@fuutu/db";
import {
	type DesktopAccess,
	evaluateDesktopAccess,
} from "@fuutu/desktop/access";
import { desktopConfig } from "@fuutu/desktop/config";
import { getUserEntitlement } from "@fuutu/payments";
import { ORPCError } from "@orpc/server";

type Entitlement = Awaited<ReturnType<typeof getUserEntitlement>>;

export type DesktopAccountAccess = {
	entitlement: Entitlement;
	deviceCount: number;
	access: DesktopAccess;
};

export type DesktopOrg = { id: string; name: string; slug: string };

/**
 * The org a desktop request is for — one the user is a member of, or none
 * (personal). An explicit switch (`requested`) to a foreign org fails; a
 * stale token org (member since removed) silently falls back to personal,
 * so a removed member never keeps the org's plan.
 */
export async function resolveDesktopOrganization(
	userId: string,
	requested: string | undefined,
	fallback: string | null | undefined,
): Promise<DesktopOrg | null> {
	for (const [orgId, explicit] of [
		[requested, true],
		[fallback, false],
	] as const) {
		if (!orgId) continue;
		const org = await getOrganizationWithMembers(orgId);
		if (org?.members.some((m) => m.userId === userId)) {
			return { id: org.id, name: org.name, slug: org.slug };
		}
		if (explicit) {
			throw new ORPCError("FORBIDDEN", { message: "Not a member" });
		}
	}
	return null;
}

/**
 * Access of a user to the desktop app in an organization context —
 * `desktopConfig.access`, trial, device limit, licensed major. One place
 * for `desktop.session` and the update route.
 */
export async function resolveDesktopAccess(input: {
	userId: string;
	userCreatedAt: Date;
	organizationId: string | null;
	now?: Date;
}): Promise<DesktopAccountAccess> {
	const [entitlement, deviceCount] = await Promise.all([
		getUserEntitlement(input.userId, {
			activeOrganizationId: input.organizationId,
		}),
		countDesktopDevices(input.userId, desktopOAuth.clientId),
	]);
	const access = evaluateDesktopAccess({
		requiredFeature: desktopConfig.access.requiredFeature,
		perMajorVersion: desktopConfig.access.perMajorVersion,
		majors: desktopConfig.access.majors,
		trialDays: desktopConfig.trial.days,
		deviceLimit: desktopConfig.devices.limit,
		features: entitlement.features,
		userCreatedAt: input.userCreatedAt,
		deviceCount,
		now: input.now ?? new Date(),
	});
	return { entitlement, deviceCount, access };
}
