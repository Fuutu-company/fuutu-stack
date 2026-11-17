import { env } from "@fuutu/env/saas";

/**
 * Log-safe shape of a thrown value. An `Error` passed to the logger as-is
 * serializes to `{}`; this keeps name and message (stack outside production).
 */
export function errorInfo(err: unknown): {
	name?: string;
	message: string;
	stack?: string;
} {
	if (!(err instanceof Error)) return { message: String(err) };
	return {
		name: err.name,
		message: err.message,
		...(env.NODE_ENV !== "production" && err.stack ? { stack: err.stack } : {}),
	};
}
