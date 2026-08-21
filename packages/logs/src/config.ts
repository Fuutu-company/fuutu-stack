/**
 * Logs configuration — owned by @fuutu/logs.
 *
 * Reads `process.env` directly (like `@fuutu/utils/getBaseUrl`) because
 * @fuutu/logs is a foundational package imported by every other package,
 * including those with minimal test setups. Importing `@fuutu/env/saas`
 * here would force every consumer to have DATABASE_URL / BETTER_AUTH_SECRET
 * set — unacceptable for a logger. The env vars are still declared in
 * `@fuutu/env/saas` for type-safe access in app code.
 */

/** Drain identifiers — evlog adapter names. Console is always on (evlog default). */
export type DrainId = "console" | "sentry" | "axiom" | "fs" | "memory";
export type AuditSinkId = "console" | "db" | "axiom" | "noop";

const VALID_DRAINS = ["console", "sentry", "axiom", "fs", "memory"] as const;
const VALID_SINKS = ["console", "db", "axiom", "noop"] as const;
const VALID_LEVELS = ["debug", "info", "warn", "error"] as const;

/**
 * Parse LOG_DRAIN env var into a list of drain ids.
 * Format: comma-separated, e.g. "sentry,fs" or "console" or "".
 * "console" is always on (evlog's default output) and is filtered out
 * of the returned list — only *additional* drains are returned.
 */
function parseDrains(raw: string | undefined): DrainId[] {
	if (!raw?.trim()) return [];
	const names = raw
		.split(",")
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
	const valid: DrainId[] = [];
	for (const name of names) {
		if ((VALID_DRAINS as readonly string[]).includes(name)) {
			if (name !== "console") {
				valid.push(name as DrainId);
			}
		} else {
			console.warn(`[logs] Unknown drain "${name}" — ignoring.`);
		}
	}
	return valid;
}

function readEnv(
	key: string,
	fallback: string,
	allowed: readonly string[],
): string {
	const raw = process.env[key];
	const value = raw ?? fallback;
	return allowed.includes(value) ? value : fallback;
}

export const logsConfig = {
	/** Additional drains beyond evlog's built-in console output. */
	get drains(): DrainId[] {
		return parseDrains(process.env.LOG_DRAIN);
	},
	get auditSink(): AuditSinkId {
		return readEnv("LOG_AUDIT_SINK", "console", VALID_SINKS) as AuditSinkId;
	},
	get level(): "debug" | "info" | "warn" | "error" {
		return readEnv("LOG_LEVEL", "info", VALID_LEVELS) as
			| "debug"
			| "info"
			| "warn"
			| "error";
	},
} as const;
