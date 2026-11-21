import { describe, expect, it } from "vitest";
import { type AppSetupStep, pendingSteps, phasesFor } from "../setup-steps";

const Step = () => null;
const step = (id: string, phase: AppSetupStep["phase"]): AppSetupStep => ({
	id,
	phase,
	Component: Step,
});

describe("setup steps (app-setup-steps.tsx)", () => {
	it("runs only pre-auth steps in front of sign-in; never the app", () => {
		expect(phasesFor("sign_in")).toEqual(["pre-auth"]);
		// No access → only the gate's own cards, no app-provided UI.
		for (const kind of ["no_access", "device_limit", "loading"]) {
			expect(phasesFor(kind)).toEqual([]);
		}
	});

	it("runs pre- then post-auth steps before the app once signed in or open", () => {
		expect(phasesFor("granted")).toEqual(["pre-auth", "post-auth"]);
		expect(phasesFor("open")).toEqual(["pre-auth", "post-auth"]);
	});

	it("lists the steps not done yet, in phase and declaration order", () => {
		const steps = [
			step("welcome", "post-auth"),
			step("language", "pre-auth"),
			step("theme", "pre-auth"),
		];
		expect(
			pendingSteps(steps, ["pre-auth", "post-auth"], new Set(["theme"])).map(
				(s) => s.id,
			),
		).toEqual(["language", "welcome"]);
		expect(pendingSteps(steps, ["pre-auth"], new Set())).toHaveLength(2);
	});

	it("refuses duplicate ids", () => {
		expect(() =>
			pendingSteps(
				[step("a", "pre-auth"), step("a", "post-auth")],
				["pre-auth"],
				new Set(),
			),
		).toThrow(/duplicate/);
	});
});
