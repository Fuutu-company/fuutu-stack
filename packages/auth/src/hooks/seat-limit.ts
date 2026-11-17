/**
 * Seat-limit enforcement for organization membership.
 *
 * The cap is the org entitlement's `seatsTotal` (`null` = unlimited) —
 * by default derived from `LIMITS[planId].membersPerOrg`, or whatever a
 * registered entitlement resolver returns — unless an app seat gate
 * (`registerSeatGate`) returns another cap for the change. Wired into `organizationHooks`
 * so every membership mutation (direct add, invitation create,
 * invitation accept) is gated regardless of which endpoint triggers it.
 *
 * Trips by throwing a Better-Auth `APIError("PAYMENT_REQUIRED")` whose
 * body carries `seatsTotal` + `upgradeUrl`; oRPC procedures re-throw it
 * as a typed `PAYMENT_REQUIRED` error (see `@fuutu/api` seat-limit-error).
 */
import {
	countOrganizationMembers,
	countPendingInvitations,
	getOrganizationById,
} from "@fuutu/db";
import { getOrgEntitlement, getSeatGate } from "@fuutu/payments";
import { getSeatUpgradeUrl } from "@fuutu/payments/config";
import { APIError } from "better-auth/api";

const SEAT_LIMIT_MESSAGE = "Organization seat limit reached";

/**
 * Resolve the org's seat cap and throw when `usedSeats` meets/exceeds
 * it. `usedSeats` is callers' occupied count (members, or members +
 * pending invitations for the invite path).
 */
async function assertWithinSeatLimit(
	organizationId: string,
	usedSeats: number,
	purpose: "member" | "invitation",
): Promise<void> {
	const { seatsTotal } = await getOrgEntitlement(organizationId);
	const gate = getSeatGate();
	const cap = gate
		? await gate(
				{ organizationId, usedSeats, seatsTotal, purpose },
				() => seatsTotal,
			)
		: seatsTotal;
	if (cap === null || usedSeats < cap) return;
	const org = await getOrganizationById(organizationId);
	throw new APIError("PAYMENT_REQUIRED", {
		message: SEAT_LIMIT_MESSAGE,
		seatsTotal: cap,
		upgradeUrl: getSeatUpgradeUrl(org?.slug ?? organizationId),
	});
}

/** Gate before a member row is added (direct add / invitation accept). */
export const assertSeatAvailable = async (
	organizationId: string,
): Promise<void> => {
	const members = await countOrganizationMembers(organizationId);
	await assertWithinSeatLimit(organizationId, members, "member");
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
	await assertWithinSeatLimit(organizationId, members + pending, "invitation");
};
