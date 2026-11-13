import { ORPCError } from "@orpc/server";
import { z } from "zod";

/** Body of the seat-limit APIError thrown by `@fuutu/auth` organizationHooks. */
const SeatLimitBodySchema = z.object({
	seatsTotal: z.number().int().nonnegative(),
	upgradeUrl: z.string().min(1),
});

export type SeatLimitErrorData = z.infer<typeof SeatLimitBodySchema>;

/**
 * Map the seat-limit Better-Auth `APIError` (HTTP 402) to a typed oRPC
 * `PAYMENT_REQUIRED` error that keeps `seatsTotal` + `upgradeUrl` on the
 * wire — a raw APIError would flatten to a 500. Returns null for any
 * other error.
 */
export function toSeatLimitError(
	err: unknown,
): ORPCError<"PAYMENT_REQUIRED", SeatLimitErrorData> | null {
	if (
		!(err instanceof Error) ||
		err.name !== "APIError" ||
		!("statusCode" in err) ||
		err.statusCode !== 402
	) {
		return null;
	}
	const body = SeatLimitBodySchema.safeParse(
		"body" in err ? err.body : undefined,
	);
	if (!body.success) return null;
	return new ORPCError("PAYMENT_REQUIRED", {
		status: 402,
		message: "Organization seat limit reached",
		data: body.data,
	});
}
