import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Error helpers of the SaaS app (`apps/saas/src/lib/api-error.ts`): a
 * refusal because support is impersonating the user (oRPC
 * `denyImpersonation`, Better Auth's `IMPERSONATION_FORBIDDEN` guard) gets
 * its own message instead of the generic "failed" fallback.
 */

const SAAS = join(import.meta.dirname, "../../../../apps/saas");
const API_ERROR = join(SAAS, "src/lib/api-error.ts");
const resolveFromApp = createRequire(join(SAAS, "package.json")).resolve;

type Translate = (key: string) => string;
type ApiError = {
	isImpersonationForbidden: (err: unknown) => boolean;
	paymentsErrorKey: (err: unknown) => string | null;
	planGateMessage: (err: unknown, t: Translate, fallbackKey: string) => string;
};
type ErrorCtor = new (
	code: string,
	options?: { message?: string; data?: unknown },
) => Error;

const { ORPCError } = (await import(
	/* @vite-ignore */ resolveFromApp("@orpc/client")
)) as { ORPCError: ErrorCtor };
const apiError = (await import(/* @vite-ignore */ API_ERROR)) as ApiError;

/** What `denyImpersonation` sends over the wire. */
const impersonationRefusal = () =>
	new ORPCError("FORBIDDEN", {
		message: "Not allowed while impersonating a user",
		data: { code: "IMPERSONATION_FORBIDDEN" },
	});

/** `res.error` of a Better Auth client call refused by the guard. */
const betterAuthRefusal = {
	code: "IMPERSONATION_FORBIDDEN",
	status: 403,
	message: "Not allowed while impersonating a user",
};

const t: Translate = (key) => `t:${key}`;

describe("isImpersonationForbidden", () => {
	it("recognises the oRPC refusal", () => {
		expect(apiError.isImpersonationForbidden(impersonationRefusal())).toBe(
			true,
		);
	});

	it("recognises Better Auth's refusal", () => {
		expect(apiError.isImpersonationForbidden(betterAuthRefusal)).toBe(true);
	});

	it("leaves other 403s alone", () => {
		expect(
			apiError.isImpersonationForbidden(
				new ORPCError("FORBIDDEN", { message: "Insufficient permissions" }),
			),
		).toBe(false);
		expect(
			apiError.isImpersonationForbidden({ code: "FORBIDDEN", status: 403 }),
		).toBe(false);
		expect(apiError.isImpersonationForbidden(null)).toBe(false);
	});
});

describe("paymentsErrorKey", () => {
	it("maps an impersonation refusal to its own payments message", () => {
		expect(apiError.paymentsErrorKey(impersonationRefusal())).toBe(
			"errors.impersonationForbidden",
		);
	});

	it("says only the payer may open the org's billing portal", () => {
		expect(
			apiError.paymentsErrorKey(
				new ORPCError("PRECONDITION_FAILED", {
					message: "Only the member who pays can open the billing portal",
					data: { reason: "portal_payer_only", payer: "j***@acme.com" },
				}),
			),
		).toBe("errors.portalPayerOnly");
	});

	it("says an active same-plan checkout is already subscribed", () => {
		expect(
			apiError.paymentsErrorKey(
				new ORPCError("PRECONDITION_FAILED", {
					message: "This plan can't be purchased right now",
					data: { reason: "already_subscribed" },
				}),
			),
		).toBe("errors.alreadySubscribed");
	});

	it("points a cancel-scheduled same-plan checkout to resuming it", () => {
		expect(
			apiError.paymentsErrorKey(
				new ORPCError("PRECONDITION_FAILED", {
					message: "This plan can't be purchased right now",
					data: { reason: "resume_instead" },
				}),
			),
		).toBe("errors.resumeInstead");
	});

	it("still falls back to the caller's key for other failures", () => {
		expect(
			apiError.paymentsErrorKey(new ORPCError("INTERNAL_SERVER_ERROR")),
		).toBeNull();
	});
});

describe("planGateMessage", () => {
	it("says the action is closed while impersonating", () => {
		expect(
			apiError.planGateMessage(impersonationRefusal(), t, "apiKeys.failed"),
		).toBe("t:common.errors.impersonationForbidden");
		expect(
			apiError.planGateMessage(betterAuthRefusal, t, "apiKeys.failed"),
		).toBe("t:common.errors.impersonationForbidden");
	});

	it("keeps the fallback for an unrelated error", () => {
		expect(
			apiError.planGateMessage(new Error("boom"), t, "apiKeys.failed"),
		).toBe("t:apiKeys.failed");
	});
});
