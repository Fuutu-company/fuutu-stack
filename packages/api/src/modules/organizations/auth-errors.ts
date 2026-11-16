import { ORPCError } from "@orpc/server";

/** Better Auth `APIError` statuses that surface as typed oRPC errors. */
const STATUS_CODES = {
	400: "BAD_REQUEST",
	403: "FORBIDDEN",
	404: "NOT_FOUND",
	409: "CONFLICT",
	429: "TOO_MANY_REQUESTS",
	502: "BAD_GATEWAY",
} as const;

function isMappedStatus(status: number): status is keyof typeof STATUS_CODES {
	return status in STATUS_CODES;
}

/**
 * Runs a Better Auth organization call and maps its `APIError` client
 * errors (profile-input validation 400, subscription-cancel failure 502, …)
 * to typed oRPC errors — unmapped they flatten to a 500. Other errors,
 * including APIErrors other mappers handle (402 seat limit), pass through.
 */
export async function withOrganizationAuthErrors<T>(
	run: () => Promise<T>,
): Promise<T> {
	try {
		return await run();
	} catch (err) {
		if (
			err instanceof Error &&
			err.name === "APIError" &&
			"statusCode" in err &&
			typeof err.statusCode === "number" &&
			isMappedStatus(err.statusCode)
		) {
			throw new ORPCError(STATUS_CODES[err.statusCode], {
				message: err.message,
			});
		}
		throw err;
	}
}
