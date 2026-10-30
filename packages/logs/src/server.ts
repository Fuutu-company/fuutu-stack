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
import { logsConfig } from "./config";
import { combineDrains, resolveDrains } from "./drains";

let initPromise: Promise<void> | null = null;

interface EvlogRegistry {
	config?: { locked?: boolean };
}

/**
 * Lock the evlog logger so nothing re-initializes it after us.
 *
 * Equivalent to evlog's `lockLogger()` — which is `@internal` and not
 * re-exported from the package root in evlog 2.x, while the internal
 * `dist/logger` entry isn't in the package's exports map at all. The
 * flag it sets lives on the process-wide config registry evlog
 * intentionally shares across duplicate installs via `Symbol.for`, so
 * we set it here directly. evlog's own integrations that would
 * otherwise re-init — `createEvlog()`/`evlogMiddleware`
 * (`configureHandler`), the instrumentation `register()`, `eve` —
 * check `isLoggerLocked()` and skip, so they can no longer wipe the
 * drains and `minLevel` initLogs configures (evlog `initLogger` is
 * last-call-wins). Duck-typed: if evlog reshapes the registry, this
 * no-ops instead of crashing init.
 */
function lockEvlogLogger(): void {
	// evlog records every loaded major under this unversioned global key.
	const majors: unknown = Reflect.get(globalThis, Symbol.for("evlog.majors"));
	if (!(majors instanceof Set)) return;
	for (const major of majors) {
		const registry: EvlogRegistry | undefined = Reflect.get(
			globalThis,
			Symbol.for(`evlog.registry.v${String(major)}`),
		);
		if (registry?.config) registry.config.locked = true;
	}
}

/**
 * Initialize evlog with configured drains.
 *
 * Called once at server boot. Safe to call multiple times — concurrent
 * and repeat calls share the first successful init. After a successful
 * init the evlog logger is locked (see `lockEvlogLogger`) so later
 * integration-level `initLogger` calls are skipped and can't wipe the
 * configured drains + `LOG_LEVEL` floor. If init throws, the in-flight
 * marker is cleared so the next call retries instead of staying
 * uninitialized forever.
 *
 * If not called, evlog defaults to console-only output, which is fine
 * for dev and tests.
 */
export function initLogs(options?: {
	service?: string;
	enabled?: boolean;
}): Promise<void> {
	if (!initPromise) {
		initPromise = (async () => {
			const drains = await resolveDrains();
			const drain = combineDrains(drains);

			evlogInitLogger({
				enabled: options?.enabled ?? true,
				env: {
					service: options?.service ?? process.env.SERVICE_NAME ?? "fuutu",
				},
				minLevel: logsConfig.level,
				...(drain ? { drain } : {}),
			});
			lockEvlogLogger();
		})().catch((error: unknown) => {
			initPromise = null;
			throw error;
		});
	}
	return initPromise;
}

export { combineDrains, resetDrains, resolveDrains } from "./drains";
