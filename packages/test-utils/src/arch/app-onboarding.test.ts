import { describe, expect, it } from "vitest";

/**
 * Step order of the onboarding wizard with app-owned steps
 * (`apps/saas/src/app-onboarding.tsx`): kit steps stay in place, app steps
 * slot in by `after`, and the final "done" step always stays last.
 */

const {
	buildOnboardingSteps,
	nextOnboardingStep,
	previousOnboardingStep,
	resumeOnboardingStep,
} = await import(
	"../../../../apps/saas/src/modules/app/onboarding/onboarding-steps"
);

describe("buildOnboardingSteps", () => {
	it("keeps the kit order without extras", () => {
		expect(buildOnboardingSteps(true, [])).toEqual([
			"profile",
			"organization",
			"done",
		]);
		expect(buildOnboardingSteps(false, [])).toEqual(["profile", "done"]);
	});

	it("places an extra step after its kit anchor", () => {
		expect(
			buildOnboardingSteps(true, [{ id: "role", after: "profile" }]),
		).toEqual(["profile", "role", "organization", "done"]);
	});

	it("puts an extra without an anchor right before done", () => {
		expect(buildOnboardingSteps(true, [{ id: "tour" }])).toEqual([
			"profile",
			"organization",
			"tour",
			"done",
		]);
	});

	it("falls back to before done when the anchor step is disabled", () => {
		expect(
			buildOnboardingSteps(false, [{ id: "invite", after: "organization" }]),
		).toEqual(["profile", "invite", "done"]);
	});

	it("leaves out an app step whose feature gate is off", () => {
		expect(
			buildOnboardingSteps(true, [
				{ id: "role", after: "profile", enabled: false },
				{ id: "tour", enabled: true },
			]),
		).toEqual(["profile", "organization", "tour", "done"]);
	});

	it("rejects an extra step reusing a kit step id", () => {
		expect(() => buildOnboardingSteps(true, [{ id: "done" }])).toThrow(
			/duplicate key "done"/,
		);
	});
});

describe("step navigation", () => {
	const steps = ["profile", "role", "organization", "done"];

	it("moves to the next step and stops at the last", () => {
		expect(nextOnboardingStep(steps, "profile")).toBe("role");
		expect(nextOnboardingStep(steps, "organization")).toBe("done");
		expect(nextOnboardingStep(steps, "done")).toBe("done");
	});

	it("moves back and stops at the first", () => {
		expect(previousOnboardingStep(steps, "organization")).toBe("role");
		expect(previousOnboardingStep(steps, "profile")).toBe("profile");
	});

	describe("with the organization created in this flow", () => {
		// App steps on both sides of the org step.
		const flow = ["profile", "role", "organization", "invite", "tour", "done"];
		const completed = ["organization"];

		it("goes back from a step after it to the step before it, never into it", () => {
			expect(previousOnboardingStep(flow, "invite", completed)).toBe("role");
			expect(previousOnboardingStep(flow, "tour", completed)).toBe("invite");
		});

		it("goes forward past it again", () => {
			expect(nextOnboardingStep(flow, "role", completed)).toBe("invite");
			expect(nextOnboardingStep(flow, "invite", completed)).toBe("tour");
		});

		it("stays put when only completed steps lie behind", () => {
			const orgFirst = ["organization", "invite", "done"];
			expect(previousOnboardingStep(orgFirst, "invite", completed)).toBe(
				"invite",
			);
		});

		it("never skips done", () => {
			expect(nextOnboardingStep(flow, "tour", ["organization", "done"])).toBe(
				"done",
			);
		});
	});
});

describe("resumeOnboardingStep (reload / return to /onboarding)", () => {
	const kit = ["profile", "organization", "done"];
	const flow = ["profile", "role", "organization", "tour", "done"];

	it("starts at the first step on a fresh visit", () => {
		expect(resumeOnboardingStep(kit, [], null)).toBe("profile");
	});

	it("returns to the step the user had reached", () => {
		expect(resumeOnboardingStep(flow, [], "role")).toBe("role");
		expect(resumeOnboardingStep(kit, [], "organization")).toBe("organization");
	});

	it("never reopens the org step once the user belongs to an org", () => {
		expect(resumeOnboardingStep(kit, ["organization"], null)).toBe("done");
		expect(resumeOnboardingStep(flow, ["organization"], "organization")).toBe(
			"tour",
		);
		// Steps before the org step were passed on the way there.
		expect(resumeOnboardingStep(flow, ["organization"], null)).toBe("tour");
	});

	it("ignores a stored step the flow no longer has", () => {
		expect(resumeOnboardingStep(kit, [], "removed-app-step")).toBe("profile");
	});
});
