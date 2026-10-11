export async function register() {
	// Prisma and env parsing are Node-only — skip the edge compile of this
	// hook entirely so the Prisma client is never bundled for Edge Runtime.
	// NEXT_RUNTIME is injected by Next.js itself (not user env) and is the
	// sanctioned exception to the @fuutu/env rule — it must be read before
	// env parsing runs.
	if (process.env.NEXT_RUNTIME !== "nodejs") {
		return;
	}
	const { env } = await import("@fuutu/env/saas");
	const { initLogs } = await import("@fuutu/logs/server");
	const { setPaymentProvider } = await import("@fuutu/payments");
	// Activate configured log drains (LOG_DRAIN=sentry|axiom|fs|memory) and
	// the LOG_LEVEL floor — without initLogs() the logger runs console-only.
	await initLogs({ service: "saas" });
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
