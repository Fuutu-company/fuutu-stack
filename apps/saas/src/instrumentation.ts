import { env } from "@fuutu/env/saas";
import { setPaymentProvider } from "@fuutu/payments";

export async function register() {
	// Override the payment provider from env when set — useful for deploys
	// where the provider differs per environment (e.g. "creem" in staging,
	// "stripe" in production). When PAYMENTS_PROVIDER is not set, the
	// `paymentsConfig.provider` default in `@fuutu/payments/config` wins.
	// This file is server-only — `@fuutu/env/saas` must never be imported
	// in `config.ts` itself (client components import it).
	if (env.PAYMENTS_PROVIDER) {
		setPaymentProvider(env.PAYMENTS_PROVIDER);
	}
}
