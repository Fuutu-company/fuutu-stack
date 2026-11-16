import { getOrganizationById } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import type { PlanId } from "@fuutu/payments/config";
import { getPlanIdForProductId } from "@fuutu/payments/config.server";
import { type DispatchEventInput, dispatchEvent } from "@fuutu/webhooks";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { adminIdSchema } from "../shared";

const log = createLogger({ scope: "api:admin" });

export const organizationIdSchema = adminIdSchema;

/** Org member roles support may assign. */
export const orgRoleSchema = z.enum(["owner", "admin", "member"]);

/** The organization an admin acts on (404 when unknown). */
export async function loadTargetOrganization(organizationId: string) {
	const org = await getOrganizationById(organizationId);
	if (!org) {
		throw new ORPCError("NOT_FOUND", { message: "Organization not found" });
	}
	return { id: org.id, name: org.name, slug: org.slug };
}

/** The plan a purchase's product maps to — `null` for top-ups and unknown products. */
export function withPlanId<
	T extends { priceId: string; productId: string | null },
>(purchase: T): T & { planId: PlanId | null } {
	return {
		...purchase,
		planId:
			getPlanIdForProductId(purchase.productId ?? purchase.priceId) ?? null,
	};
}

/**
 * The outgoing webhook the regular organization procedure sends for the
 * same change. Best effort, as there: a failed dispatch never fails the
 * support action. No `userId` — customers' endpoints are not told which
 * support admin acted.
 */
export async function dispatchOrganizationEvent(
	input: Pick<DispatchEventInput, "event" | "organizationId" | "payload">,
): Promise<void> {
	try {
		await dispatchEvent(input);
	} catch (err) {
		log.warn("webhook dispatch failed", { err });
	}
}

export const memberNotFound = () =>
	new ORPCError("NOT_FOUND", { message: "Member not found" });

export const invitationNotFound = () =>
	new ORPCError("NOT_FOUND", { message: "Invitation not found" });
