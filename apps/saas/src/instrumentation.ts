import { defineNodeInstrumentation } from "@fuutu/logs/next/instrumentation";

// evlog Next.js instrumentation — we intentionally take ONLY `onRequestError`
// (structured logging for SSR/RSC request errors) and not `register`. The
// evlog register() re-runs initLogger() with no drain, and evlog's initLogger
// is last-call-wins — it would clobber the LOG_DRAIN drains + LOG_LEVEL floor
// that initLogs() (below, in register) configures. initLogs stays the single
// logger init for this app. The NEXT_RUNTIME gate is inside the evlog hooks,
// so this is safe to evaluate in the edge compile too.
const evlogInstrumentation = defineNodeInstrumentation({ service: "saas" });
export const onRequestError = evlogInstrumentation.onRequestError;

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
	// initLogs retries drain setup and rejects on failure; a logging outage
	// must not take down the rest of boot (payment provider below), so we
	// warn and continue. console.* is the documented exception for boot
	// code — no logger may be up yet when this fails.
	try {
		await initLogs({ service: "saas" });
	} catch (err) {
		console.warn(
			"[instrumentation] initLogs failed; continuing without configured log drains",
			err,
		);
	}
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
