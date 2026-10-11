import type { z } from "zod";

/**
 * Polymorphic-owner invariant for credit records: exactly one of
 * userId / organizationId must be set. Mirrors the XOR CHECK
 * constraint on the DB tables — enforced here so bad input fails
 * fast with a clear message instead of a constraint violation.
 */
export function ownerXorIssue(value: {
	userId?: string | null;
	organizationId?: string | null;
}): string | null {
	if (!value.userId && !value.organizationId) {
		return "either userId or organizationId must be set";
	}
	if (value.userId && value.organizationId) {
		return "only one of userId or organizationId may be set";
	}
	return null;
}

export const ownerXorCheck = <
	T extends z.ZodType<{
		userId?: string | null;
		organizationId?: string | null;
	}>,
>(
	schema: T,
): T =>
	schema.superRefine((value, ctx) => {
		const message = ownerXorIssue(value);
		if (message) {
			ctx.addIssue({ code: "custom", message });
		}
	});
