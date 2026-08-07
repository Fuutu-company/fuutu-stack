import { createLogger } from "@fuutu/logs";
import { paymentsConfig } from "./config";
import { polarPaymentProvider } from "./providers/polar";
import {
	creemPaymentProvider,
	dodopaymentsPaymentProvider,
	lemonsqueezyPaymentProvider,
	noopPaymentProvider,
	stripePaymentProvider,
} from "./providers/skeletons";
import type { PaymentProvider } from "./types";

const log = createLogger({ scope: "payments:resolve" });

/**
 * Resolve the active payment provider from `paymentsConfig.provider`.
 *
 * Kept separate from `types.ts` so importing types (zero runtime cost)
 * does not pull the Polar SDK. Consumers that need *only* the contract
 * import from the barrel; consumers that need to invoke a provider call
 * this function.
 */
export function resolvePaymentProvider(): PaymentProvider {
	switch (paymentsConfig.provider) {
		case "polar":
			return polarPaymentProvider;
		case "stripe":
			return stripePaymentProvider;
		case "lemonsqueezy":
			return lemonsqueezyPaymentProvider;
		case "creem":
			return creemPaymentProvider;
		case "dodopayments":
			return dodopaymentsPaymentProvider;
		case "noop":
			return noopPaymentProvider;
		default: {
			log.warn(
				`unknown provider "${paymentsConfig.provider}", falling back to noop.`,
			);
			return noopPaymentProvider;
		}
	}
}
