/**
 * @fuutu/logs — evlog-backed logging facade.
 *
 * This package is the single import source for logging across the monorepo.
 * It wraps evlog (https://evlog.dev) and exposes:
 *
 * - `createLogger({ scope })` — backward-compat scoped logger (debug/info/warn/error)
 * - `createAuditLogger({ scope })` — persistent audit trail writer
 *
 * Server-only APIs (initLogs, drains, framework integrations) are available
 * via subpath exports to keep Node-only modules out of browser bundles:
 *   import { initLogs } from "@fuutu/logs/server"
 *   import { createError } from "@fuutu/logs/errors"
 *   import { evlog, withEvlog } from "@fuutu/logs/orpc"
 *   import { createEvlog } from "@fuutu/logs/next"
 *
 * Drains are env-driven via LOG_DRAIN (comma-separated):
 *   LOG_DRAIN=""           → console only (default, always on)
 *   LOG_DRAIN="sentry"     → + Sentry Logs (needs SENTRY_DSN)
 *   LOG_DRAIN="axiom"      → + Axiom (needs AXIOM_API_KEY + AXIOM_DATASET)
 *   LOG_DRAIN="fs"         → + NDJSON files in .evlog/logs/
 *   LOG_DRAIN="memory"     → + in-memory ring buffer (dev/agents)
 *   LOG_DRAIN="sentry,fs"  → both
 *
 * To swap evlog for another library: replace drains.ts + compat.ts.
 * The rest of the monorepo imports only from @fuutu/logs and is unaffected.
 */

// Audit (separate from ephemeral log stream)
export {
	consoleAuditSink,
	createAuditLogger,
	getAuditSink,
	setAuditSink,
} from "./audit";
// Backward-compat facade — imports only evlog's `log` object (browser-safe)
export { createLogger } from "./compat";
export type { AuditSinkId, DrainId } from "./config";
// Config
export { logsConfig } from "./config";
export type {
	AuditEvent,
	AuditLogger,
	AuditSink,
	Logger,
	LoggerOptions,
	LogMeta,
} from "./types";
