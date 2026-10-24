import { defineNodeInstrumentation } from "@fuutu/logs/next/instrumentation";

// evlog Next.js instrumentation — we intentionally take ONLY `onRequestError`
// (structured logging for SSR/RSC request errors) and not `register`. The
// evlog register() re-runs initLogger() with no drain, and evlog's initLogger
// is last-call-wins — it would clobber the LOG_DRAIN drains + LOG_LEVEL floor
// that initLogs() (below, in register) configures. initLogs stays the single
// logger init for this app. The NEXT_RUNTIME gate is inside the evlog hooks,
// so this is safe to evaluate in the edge compile too.
const evlogInstrumentation = defineNodeInstrumentation({ service: "docs" });
export const onRequestError = evlogInstrumentation.onRequestError;

export async function register() {
	// NEXT_RUNTIME is injected by Next.js itself (not user env) and is the
	// sanctioned exception to the @fuutu/env rule — the gate keeps this hook
	// inert in the edge compile so Node-only log init is never bundled for
	// Edge Runtime.
	if (process.env.NEXT_RUNTIME !== "nodejs") {
		return;
	}
	const { initLogs } = await import("@fuutu/logs/server");
	// Activate configured log drains (LOG_DRAIN=sentry|axiom|fs|memory) and
	// the LOG_LEVEL floor — without initLogs() the logger runs console-only.
	// initLogs retries drain setup and rejects on failure; a logging outage
	// must not take down the rest of boot, so we warn and continue.
	// console.* is the documented exception for boot code — no logger may
	// be up yet when this fails.
	try {
		await initLogs({ service: "docs" });
	} catch (err) {
		console.warn(
			"[instrumentation] initLogs failed; continuing without configured log drains",
			err,
		);
	}
}
