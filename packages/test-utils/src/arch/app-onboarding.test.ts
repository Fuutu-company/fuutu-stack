import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Step order of the onboarding wizard with app-owned steps
 * (`apps/saas/src/app-onboarding.tsx`): kit steps stay in place, app steps
 * slot in by `after`, and the final "done" step always stays last.
 */

const {
	buildOnboardingSteps,
	nextOnboardingStep,
	onboardingStepsFor,
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

describe("onboardingStepsFor (organizations mode × existing membership)", () => {
	const appSteps = [
		{ id: "role", after: "profile" as const },
		{ id: "invite", after: "organization" as const },
		{ id: "tour" },
	];

	it("forced mode without an org runs the org step", () => {
		expect(onboardingStepsFor("forced", false, [])).toEqual([
			"profile",
			"organization",
			"done",
		]);
	});

	it("forced mode with an org leaves out only the org step", () => {
		expect(onboardingStepsFor("forced", true, [])).toEqual(["profile", "done"]);
		// App steps anchored on the org step keep their place.
		expect(onboardingStepsFor("forced", true, appSteps)).toEqual([
			"profile",
			"role",
			"invite",
			"tour",
			"done",
		]);
	});

	it("on mode keeps the org step, membership or not", () => {
		const expected = ["profile", "organization", "done"];
		expect(onboardingStepsFor("on", false, [])).toEqual(expected);
		expect(onboardingStepsFor("on", true, [])).toEqual(expected);
	});

	it("off mode has no org step", () => {
		expect(onboardingStepsFor("off", false, [])).toEqual(["profile", "done"]);
		expect(onboardingStepsFor("off", true, [])).toEqual(["profile", "done"]);
	});
});

describe("onboarding wizard wiring", () => {
	// The kit E2E runs with orgs "on" — this keeps forced mode's membership
	// rule from silently dropping out of the wizard.
	it("builds the steps from the organizations mode and the user's membership", () => {
		const wizard = readFileSync(
			join(
				import.meta.dirname,
				"../../../../apps/saas/src/modules/app/onboarding/onboarding-wizard.tsx",
			),
			"utf8",
		);
		expect(wizard).toMatch(
			/onboardingStepsFor\(\s*config\.features\.organizationsMode,\s*hasOrganization,\s*appOnboardingSteps,?\s*\)/,
		);
		expect(wizard).not.toMatch(/buildOnboardingSteps\(/);
	});
});

describe("resumeOnboardingStep (reload / return to /onboarding)", () => {
	const kit = ["profile", "organization", "done"];
	const flow = ["profile", "role", "organization", "tour", "done"];

	it("starts at the first step on a fresh visit", () => {
		expect(resumeOnboardingStep(kit, [], null)).toBe("profile");
		// Forced mode, user already in an org: the org step is gone, the
		// profile step still comes first.
		expect(
			resumeOnboardingStep(onboardingStepsFor("forced", true, []), [], null),
		).toBe("profile");
	});

	it("a fresh visit starts at the first step even with the org created", () => {
		expect(resumeOnboardingStep(kit, ["organization"], null)).toBe("profile");
		expect(resumeOnboardingStep(flow, ["organization"], null)).toBe("profile");
	});

	it("returns to the step the user had reached", () => {
		expect(resumeOnboardingStep(flow, [], "role")).toBe("role");
		expect(resumeOnboardingStep(kit, [], "organization")).toBe("organization");
		expect(resumeOnboardingStep(flow, ["organization"], "tour")).toBe("tour");
	});

	it("never reopens the org step once it was completed in this tab", () => {
		expect(resumeOnboardingStep(kit, ["organization"], "organization")).toBe(
			"done",
		);
		expect(resumeOnboardingStep(flow, ["organization"], "organization")).toBe(
			"tour",
		);
	});

	it("ignores a stored step the flow no longer has", () => {
		expect(resumeOnboardingStep(kit, [], "removed-app-step")).toBe("profile");
		// Org step dropped because the user now belongs to one.
		expect(
			resumeOnboardingStep(
				onboardingStepsFor("forced", true, []),
				[],
				"organization",
			),
		).toBe("profile");
	});
});
