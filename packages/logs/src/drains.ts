/**
 * Drain resolution — picks evlog drain adapter(s) from LOG_DRAIN env var.
 *
 * evlog always has console output on by default (pretty in dev, structured
 * JSON in prod). The drains here are *additional* destinations — cloud
 * services (Sentry, Axiom) or local persistence (fs, memory).
 *
 * To swap evlog for another logging library, replace this file with drains
 * that target the new library's adapter API. The rest of @fuutu/logs
 * (createLogger, createAuditLogger, createError, useLogger) stays the same.
 */
import type { DrainContext, DrainFn } from "evlog";
import { type DrainId, logsConfig } from "./config";

// evlog drain adapters — lazy imports so missing credentials don't crash
// packages that only need console logging.
type AdapterDrainFn = (ctx: DrainContext | DrainContext[]) => Promise<void>;

async function loadDrain(id: DrainId): Promise<DrainFn | null> {
	let adapter: AdapterDrainFn | null = null;
	switch (id) {
		case "sentry": {
			const { createSentryDrain } = await import("evlog/sentry");
			adapter = createSentryDrain() as AdapterDrainFn;
			break;
		}
		case "axiom": {
			const { createAxiomDrain } = await import("evlog/axiom");
			adapter = createAxiomDrain() as AdapterDrainFn;
			break;
		}
		case "fs": {
			const { createFsDrain } = await import("evlog/fs");
			adapter = createFsDrain() as AdapterDrainFn;
			break;
		}
		case "memory": {
			const { createMemoryDrain } = await import("evlog/memory");
			adapter = createMemoryDrain() as AdapterDrainFn;
			break;
		}
	}
	// Adapter accepts DrainContext | DrainContext[]; our DrainFn expects
	// single DrainContext. Wrap to narrow the type.
	if (!adapter) return null;
	return ((ctx: DrainContext) => adapter(ctx)) as DrainFn;
}

let cachedDrains: DrainFn[] | null = null;
let drainPromise: Promise<DrainFn[]> | null = null;

/**
 * Resolve all configured drains. Drains are loaded lazily (dynamic import)
 * so that packages which only use console logging never pull in
 * `evlog/sentry`, `evlog/axiom`, etc.
 *
 * Async — callers must await it, otherwise drains silently never attach.
 * The in-flight promise is shared so concurrent calls trigger one load.
 * If no extra drains are configured, resolves to an empty array — evlog's
 * built-in console output handles it. If resolution itself throws, the
 * in-flight promise is cleared so the next call retries (same pattern as
 * `initLogs` in server.ts).
 */
export function resolveDrains(): Promise<DrainFn[]> {
	if (cachedDrains) return Promise.resolve(cachedDrains);
	if (!drainPromise) {
		drainPromise = (async () => {
			const configured = logsConfig.drains;
			const drains: DrainFn[] = [];
			for (const id of configured) {
				try {
					const drain = await loadDrain(id);
					if (drain) drains.push(drain);
				} catch (error) {
					console.warn(
						`[logs] Failed to load drain "${id}" — falling back to console only.`,
						error,
					);
				}
			}
			if (configured.length > 0 && drains.length === 0) {
				console.warn(
					`[logs] LOG_DRAIN is set (${configured.join(",")}) but no drain attached — console only.`,
				);
			}
			cachedDrains = drains;
			return drains;
		})().catch((error: unknown) => {
			drainPromise = null;
			throw error;
		});
	}
	return drainPromise;
}

/**
 * Force drain re-resolution (for tests).
 */
export function resetDrains(): void {
	cachedDrains = null;
	drainPromise = null;
}

/**
 * Multi-drain combiner — fans out to all drains in parallel.
 * Used when passing a single drain fn to evlog's initLogger.
 */
export function combineDrains(drains: DrainFn[]): DrainFn | undefined {
	if (drains.length === 0) return undefined;
	// Always wrap — even a single drain gets failure isolation so a
	// throwing drain can't propagate back into evlog's emit path.
	// Self-diagnostics go through console — the failing drains can't
	// report themselves. Warn once per drain so a broken drain is
	// visible without spamming every event. Limitation: evlog's own
	// drain adapters swallow delivery failures internally, so this
	// warn-once only fires for custom drains or adapter bugs — a dying
	// Sentry backend will not surface here.
	const warned = new Set<number>();
	return (async (ctx: DrainContext) => {
		const results = await Promise.allSettled(drains.map((d) => d(ctx)));
		for (const [index, result] of results.entries()) {
			if (result.status === "rejected" && !warned.has(index)) {
				warned.add(index);
				console.warn(
					`[logs] drain #${index} failed at runtime — continuing with remaining drains.`,
					result.reason,
				);
			}
		}
	}) as DrainFn;
}
