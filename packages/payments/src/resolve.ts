import { createLogger } from "@fuutu/logs";
import { paymentsConfig } from "./config";
import { creemPaymentProvider } from "./providers/creem";
import { polarPaymentProvider } from "./providers/polar";
import { noopPaymentProvider } from "./providers/skeletons";
import { stripePaymentProvider } from "./providers/stripe";
import { type PaymentProvider, WebhookConfigError } from "./types";

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
				throw new WebhookConfigError(
					'[payments] provider is "custom" but paymentsConfig.customProvider is not set. Pass your PaymentProvider implementation.',
				);
			}
			return paymentsConfig.customProvider;
		case "noop":
			return noopPaymentProvider;
		default: {
			// Unreachable per the PaymentProviderId union — a value landing
			// here is a stale runtime override (e.g. a removed provider id).
			// Fail loud instead of silently disabling payments.
			log.error(
				`unknown provider "${String(paymentsConfig.provider)}" — implement it via paymentsConfig.customProvider`,
			);
			throw new WebhookConfigError(
				`[payments] unknown provider "${String(paymentsConfig.provider)}" — implement it via paymentsConfig.customProvider`,
			);
		}
	}
}
