/**
 * A tool failure whose message is safe to show to the caller. Any other
 * thrown error is reported as a generic "internal error" and forwarded to
 * `onError` for logging.
 */
export class McpToolError extends Error {
	override name = "McpToolError";
}
