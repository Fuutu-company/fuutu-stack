import { CREDIT_TOPUPS } from "@fuutu/payments";
import { getCreditTopupPriceId } from "@fuutu/payments/config.server";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";

export const getTopupPackages = protectedProcedure
	.route({
		method: "GET",
		path: "/payments/topup-packages",
		tags: ["Payments"],
		summary: "Get available top-up packages",
		description: "Returns a list of available credit top-up packages.",
	})
	.input(z.object({}).optional())
	.handler(async () => {
		// Only catalog fields the UI needs — never the env var name or the
		// resolved provider priceId. Price resolution stays server-side:
		// topupCheckout.create takes the opaque topup `id` and resolves the
		// price from env there. A package without a configured price is not
		// purchasable and is filtered out.
		const packages = CREDIT_TOPUPS.filter(
			(topup) => getCreditTopupPriceId(topup.id) !== undefined,
		).map((topup) => ({
			id: topup.id,
			meterKey: topup.meterKey,
			amount: topup.amount,
			displayPrice: topup.displayPrice,
			popular: topup.popular,
		}));

		return { packages };
	});
