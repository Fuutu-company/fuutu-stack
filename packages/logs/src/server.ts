/**
 * @fuutu/logs/server — server-only initialization.
 *
 * This subpath export is separated from the main entry so that
 * `import("evlog")` and `import("./drains")` (which pull Node-only
 * modules like `node:fs`) never leak into browser bundles.
 *
 * Usage in instrumentation.ts or auth/src/index.ts:
 * ```ts
 * import { initLogs } from "@fuutu/logs/server";
 * await initLogs({ service: "saas" });
 * ```
 */
import { initLogger as evlogInitLogger } from "evlog";
import { combineDrains, resolveDrains } from "./drains";

let initialized = false;

/**
 * Initialize evlog with configured drains.
 *
 * Called once at server boot. Safe to call multiple times — only the
 * first call takes effect (evlog locks the logger after init).
 *
 * If not called, evlog defaults to console-only output, which is fine
 * for dev and tests.
 */
export async function initLogs(options?: {
	service?: string;
	enabled?: boolean;
}): Promise<void> {
	if (initialized) return;
	initialized = true;

	const drains = resolveDrains();
	const drain = combineDrains(drains);

	evlogInitLogger({
		enabled: options?.enabled ?? true,
		env: {
			service: options?.service ?? process.env.SERVICE_NAME ?? "fuutu",
		},
		...(drain ? { drain } : {}),
	});
}

export { combineDrains, resetDrains, resolveDrains } from "./drains";
