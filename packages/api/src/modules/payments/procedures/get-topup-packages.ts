import { CREDIT_TOPUPS, getCreditTopupPriceId } from "@fuutu/payments";
import { protectedProcedure } from "../../../orpc";

export const getTopupPackages = protectedProcedure
	.route({
		method: "GET",
		path: "/payments/topup-packages",
		tags: ["Payments"],
		summary: "Get available top-up packages",
		description:
			"Returns a list of available credit top-up packages with their price IDs.",
	})
	.handler(async () => {
		const packages = CREDIT_TOPUPS.map((topup) => ({
			...topup,
			priceId: getCreditTopupPriceId(topup.id),
		})).filter((topup) => topup.priceId !== undefined);

		return { packages };
	});
