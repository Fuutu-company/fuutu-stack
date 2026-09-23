export async function register() {
	// Prisma and env parsing are Node-only — skip the edge compile of this
	// hook entirely so the Prisma client is never bundled for Edge Runtime.
	if (process.env.NEXT_RUNTIME !== "nodejs") {
		return;
	}
	const { env } = await import("@fuutu/env/saas");
	const { setPaymentProvider } = await import("@fuutu/payments");
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
