import {
	revokeCreditPackageForPurchaseTx,
	revokeRecurringBalancesTx,
} from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { z } from "zod";
import { ownerXorCheck } from "./owner";

const log = createLogger({ scope: "credits:revoke" });

export const RevokeRecurringCreditsSchema = ownerXorCheck(
	z.object({
		userId: z.string().optional(),
		organizationId: z.string().optional(),
		reason: z.string().min(1),
	}),
);

/**
 * Revoke the unused recurring credits of a user or org — a refunded or
 * disputed subscription, or a trial that ended unpaid. Consumed credits
 * stay consumed; the next paid renewal grants again. Idempotent.
 */
export async function revokeRecurringCredits(params: {
	userId?: string;
	organizationId?: string;
	reason: string;
}): Promise<void> {
	const { userId, organizationId, reason } =
		RevokeRecurringCreditsSchema.parse(params);
	const revoked = await revokeRecurringBalancesTx({
		userId,
		organizationId,
		reason,
	});
	log.info("revoked recurring credits", {
		userId,
		organizationId,
		reason,
		balances: revoked,
	});
}

/**
 * Revoke the unused rest of the top-up package bought with `purchaseId`
 * (refund or dispute of that purchase). `false` when the purchase granted
 * no package or it is already revoked/expired. Idempotent.
 */
export async function revokeTopUpCredits(params: {
	purchaseId: string;
	reason: string;
}): Promise<boolean> {
	const revoked = await revokeCreditPackageForPurchaseTx(
		params.purchaseId,
		params.reason,
	);
	if (revoked) {
		log.info("revoked top-up credits", params);
	}
	return revoked;
}
