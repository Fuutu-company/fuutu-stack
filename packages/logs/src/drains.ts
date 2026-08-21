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
		default:
			return null;
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
 * Returns an array of drain functions. If no extra drains are configured,
 * returns an empty array — evlog's built-in console output handles it.
 */
export function resolveDrains(): DrainFn[] {
	if (cachedDrains) return cachedDrains;
	if (!drainPromise) {
		drainPromise = (async () => {
			const drains: DrainFn[] = [];
			for (const id of logsConfig.drains) {
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
			cachedDrains = drains;
			return drains;
		})();
	}
	// Return empty until async load completes — evlog's console output
	// is always active, so no logs are lost during the brief startup window.
	return cachedDrains ?? [];
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
	if (drains.length === 1) return drains[0];
	return (async (ctx: DrainContext) => {
		await Promise.allSettled(drains.map((d) => d(ctx)));
	}) as DrainFn;
}
