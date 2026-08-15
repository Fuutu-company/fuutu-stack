import { createLogger } from "@fuutu/logs";
import { paymentsConfig } from "./config";
import { creemPaymentProvider } from "./providers/creem";
import { polarPaymentProvider } from "./providers/polar";
import { noopPaymentProvider } from "./providers/skeletons";
import { stripePaymentProvider } from "./providers/stripe";
import type { PaymentProvider } from "./types";

const log = createLogger({ scope: "payments:resolve" });

/**
 * Resolve the active payment provider from `paymentsConfig.provider`.
 *
 * Kept separate from `types.ts` so importing types (zero runtime cost)
 * does not pull any provider SDK. Consumers that need *only* the contract
 * import from the barrel; consumers that need to invoke a provider call
 * this function.
 */
export function resolvePaymentProvider(): PaymentProvider {
	switch (paymentsConfig.provider) {
		case "polar":
			return polarPaymentProvider;
		case "stripe":
			return stripePaymentProvider;
		case "creem":
			return creemPaymentProvider;
		case "custom":
			if (!paymentsConfig.customProvider) {
				log.error(
					'provider is "custom" but no customProvider implementation is set in paymentsConfig.customProvider',
				);
				throw new Error(
					'[payments] provider is "custom" but paymentsConfig.customProvider is not set. Pass your PaymentProvider implementation.',
				);
			}
			return paymentsConfig.customProvider;
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
