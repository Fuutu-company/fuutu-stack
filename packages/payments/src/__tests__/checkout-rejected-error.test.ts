import { describe, expect, it, vi } from "vitest";

// Regression: checkout guards are registered at server start
// (`server-init.ts`, the instrumentation bundle) and run inside the API
// route bundle — Next.js evaluates `@fuutu/payments` once per bundle, so
// the guard throws another module instance's CheckoutRejectedError. The
// procedure's `instanceof` must still recognise it, or a refusal reaches
// the client as a 500 instead of PRECONDITION_FAILED with its reason.

describe("CheckoutRejectedError across module instances", () => {
	it("an error from another bundle's copy of the module is an instance", async () => {
		const routeBundle = await import("../types");
		vi.resetModules();
		const instrumentationBundle = await import("../types");
		expect(instrumentationBundle.CheckoutRejectedError).not.toBe(
			routeBundle.CheckoutRejectedError,
		);

		const thrown = new instrumentationBundle.CheckoutRejectedError(
			"trial_single_seat",
		);
		expect(thrown instanceof routeBundle.CheckoutRejectedError).toBe(true);
		expect(thrown.reason).toBe("trial_single_seat");
	});

	it("other errors are not instances", async () => {
		const { CheckoutRejectedError } = await import("../types");
		const lookalike = Object.assign(new Error("Checkout rejected: x"), {
			name: "CheckoutRejectedError",
			reason: "x",
		});
		expect(lookalike instanceof CheckoutRejectedError).toBe(false);
		const nothing: unknown = null;
		expect(nothing instanceof CheckoutRejectedError).toBe(false);
		expect(new CheckoutRejectedError("x") instanceof Error).toBe(true);
	});

	it("a subclass matches only its own instances", async () => {
		const { CheckoutRejectedError } = await import("../types");
		class SeatRejection extends CheckoutRejectedError {}

		expect(new CheckoutRejectedError("x") instanceof SeatRejection).toBe(false);
		expect(new SeatRejection("x") instanceof SeatRejection).toBe(true);
		expect(new SeatRejection("x") instanceof CheckoutRejectedError).toBe(true);
	});
});
