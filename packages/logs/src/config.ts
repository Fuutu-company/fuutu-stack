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
export type LogProviderId = "evlog" | "console" | "pino" | "axiom" | "noop";
export type AuditSinkId = "console" | "db" | "axiom" | "noop";

function readEnv(
	key: string,
	fallback: string,
	allowed: readonly string[],
): string {
	const raw = process.env[key];
	const value = raw ?? fallback;
	return allowed.includes(value) ? value : fallback;
}

const PROVIDERS = ["evlog", "console", "pino", "axiom", "noop"] as const;
const SINKS = ["console", "db", "axiom", "noop"] as const;
const LEVELS = ["debug", "info", "warn", "error"] as const;

export const logsConfig = {
	get provider(): LogProviderId {
		return readEnv("LOG_PROVIDER", "evlog", PROVIDERS) as LogProviderId;
	},
	get auditSink(): AuditSinkId {
		return readEnv("LOG_AUDIT_SINK", "console", SINKS) as AuditSinkId;
	},
	get level(): "debug" | "info" | "warn" | "error" {
		return readEnv("LOG_LEVEL", "info", LEVELS) as
			| "debug"
			| "info"
			| "warn"
			| "error";
	},
} as const;
