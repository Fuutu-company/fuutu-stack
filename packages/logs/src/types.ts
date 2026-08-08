export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogMeta = Record<string, unknown>;

export interface LogContext {
	scope?: string;
	meta?: LogMeta;
}

export interface LogProvider {
	log(level: LogLevel, message: string, context: LogContext): void;
}

export interface Logger {
	debug(message: string, meta?: LogMeta): void;
	info(message: string, meta?: LogMeta): void;
	warn(message: string, meta?: LogMeta): void;
	error(message: string, meta?: LogMeta): void;
}

export interface LoggerOptions {
	scope?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Audit logs — persistent, append-only, forensic. Lives alongside the
// ephemeral LogProvider so every `log.audit(…)` call:
//   1. writes the canonical row via the active AuditSink (DB/S3/…)
//   2. mirrors an `info` entry through the active LogProvider for devs.
// ──────────────────────────────────────────────────────────────────────────

export interface AuditEvent {
	/** Dotted action identifier, e.g. "auth.sign_in", "org.invite.accept". */
	action: string;
	/** Subject the event relates to. Nullable for anonymous flows. */
	userId?: string | null;
	/** Request IP address if available. */
	ip?: string | null;
	/** Request User-Agent if available. */
	userAgent?: string | null;
	/** Arbitrary structured payload. Must be JSON-serialisable. */
	metadata?: Record<string, unknown>;
}

export interface AuditSink {
	record(event: AuditEvent): Promise<void>;
}

export interface AuditLogger {
	record(event: Omit<AuditEvent, "action"> & { action: string }): Promise<void>;
}
