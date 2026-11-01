/**
 * Seat-limit enforcement for organization membership.
 *
 * The plan catalog meters seats via `LIMITS[planId].membersPerOrg`
 * (`number | "unlimited" | false` — `false` means the plan grants no
 * member seats at all). Wired into `organizationHooks` so every
 * membership mutation (direct add, invitation create, invitation
 * accept) is gated regardless of which endpoint triggers it.
 *
 * Trips by throwing a Better-Auth `APIError("PAYMENT_REQUIRED")` whose
 * body carries `seatsTotal` + `upgradeUrl` so API layers can map it to
 * an upgrade prompt.
 */
import { countOrganizationMembers, countPendingInvitations } from "@fuutu/db";
import { env } from "@fuutu/env/saas";
import { getOrgEntitlement } from "@fuutu/payments";
import { APIError } from "better-auth/api";

const SEAT_LIMIT_MESSAGE = "Organization seat limit reached";

function seatUpgradeUrl(): string {
	const base = env.NEXT_PUBLIC_MARKETING_URL;
	return base ? `${base}/pricing` : "/pricing";
}

/**
 * Resolve the org's seat cap and throw when `usedSeats` meets/exceeds
 * it. `usedSeats` is callers' occupied count (members, or members +
 * pending invitations for the invite path).
 */
async function assertWithinSeatLimit(
	organizationId: string,
	usedSeats: number,
): Promise<void> {
	const { limits } = await getOrgEntitlement(organizationId);
	const seatsTotal = limits.membersPerOrg;
	if (seatsTotal === "unlimited") return;
	const allowed = seatsTotal === false ? 0 : seatsTotal;
	if (usedSeats >= allowed) {
		throw new APIError("PAYMENT_REQUIRED", {
			message: SEAT_LIMIT_MESSAGE,
			seatsTotal: allowed,
			upgradeUrl: seatUpgradeUrl(),
		});
	}
}

/** Gate before a member row is added (direct add / invitation accept). */
export const assertSeatAvailable = async (
	organizationId: string,
): Promise<void> => {
	const members = await countOrganizationMembers(organizationId);
	await assertWithinSeatLimit(organizationId, members);
};

/**
 * Gate before an invitation is created — pending invitations reserve a
 * seat, so they count toward the cap alongside current members.
 */
export const assertInviteSeatAvailable = async (
	organizationId: string,
): Promise<void> => {
	const [members, pending] = await Promise.all([
		countOrganizationMembers(organizationId),
		countPendingInvitations(organizationId),
	]);
	await assertWithinSeatLimit(organizationId, members + pending);
};
