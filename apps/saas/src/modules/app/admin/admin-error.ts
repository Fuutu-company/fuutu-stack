import { ORPCError } from "@orpc/client";

export type AdminErrorKey =
	| "forbidden"
	| "conflict"
	| "notFound"
	| "rateLimited"
	| "invalid"
	| "paymentProvider"
	| "generic";

/**
 * Maps an API error to a `admin.errors.*` translation key. Server messages
 * are English and technical — the UI shows its own localized, generic text.
 */
export function adminErrorKey(err: unknown): AdminErrorKey {
	if (!(err instanceof ORPCError)) return "generic";
	switch (err.code) {
		case "FORBIDDEN":
		case "UNAUTHORIZED":
			return "forbidden";
		case "CONFLICT":
			return "conflict";
		case "NOT_FOUND":
			return "notFound";
		case "TOO_MANY_REQUESTS":
			return "rateLimited";
		case "BAD_REQUEST":
			return "invalid";
		case "BAD_GATEWAY":
			return "paymentProvider";
		default:
			return "generic";
	}
}
