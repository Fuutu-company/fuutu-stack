import { insertAfter } from "@fuutu/utils/insert-after";
import type { ComponentType } from "react";

/** Kit onboarding steps an app step can be placed after. */
export type KitOnboardingStepId = "profile" | "organization";

/** Navigation callbacks the wizard passes to an app step. */
export interface OnboardingStepProps {
	/** Continue to the next step (call after your step saved its data). */
	onNext(): void;
	/** Return to the previous step. */
	onBack(): void;
}

/** App-provided wizard step — see `apps/saas/src/app-onboarding.tsx`. */
export interface AppOnboardingStep {
	/** Unique step id; must not reuse a kit id (`profile`, `organization`, `done`). */
	id: string;
	/** Kit step to follow; omitted or disabled (orgs off) → right before `done`. */
	after?: KitOnboardingStepId;
	/** Heading above the step, i18n key under `onboarding.*`. */
	titleKey: string;
	/** Feature gate — `false` leaves the step out. Default `true`. */
	enabled?: boolean;
	Component: ComponentType<OnboardingStepProps>;
}

const DONE_STEP = "done";

/**
 * Ordered step ids: kit steps (organization only when orgs are on), app
 * steps placed by `after` (gated-off ones left out), and `done` always last.
 */
export function buildOnboardingSteps(
	orgsEnabled: boolean,
	appSteps: readonly Pick<AppOnboardingStep, "id" | "after" | "enabled">[],
): string[] {
	const kitSteps = orgsEnabled
		? ["profile", "organization", DONE_STEP]
		: ["profile", DONE_STEP];
	// Merging with `done` in the list rejects an extra reusing its id;
	// unanchored extras land behind it and move in front below.
	const merged = insertAfter(
		kitSteps,
		appSteps
			.filter((step) => step.enabled !== false)
			.map((step) => ({ after: step.after, item: step.id })),
		(id) => id,
	);
	return [...merged.filter((id) => id !== DONE_STEP), DONE_STEP];
}

/**
 * Step after `from`, skipping `completed` steps that must not run twice in
 * one flow (e.g. `organization` once the org was created). `done` is never
 * skipped and stays the last stop.
 */
export function nextOnboardingStep(
	steps: readonly string[],
	from: string,
	completed: readonly string[] = [],
): string {
	for (let i = steps.indexOf(from) + 1; i < steps.length; i++) {
		const id = steps[i];
		if (id && (id === DONE_STEP || !completed.includes(id))) return id;
	}
	return DONE_STEP;
}

/**
 * Step before `from`, skipping `completed` steps; stays on `from` when
 * only completed steps (or none) lie behind it.
 */
export function previousOnboardingStep(
	steps: readonly string[],
	from: string,
	completed: readonly string[] = [],
): string {
	for (let i = steps.indexOf(from) - 1; i >= 0; i--) {
		const id = steps[i];
		if (id && !completed.includes(id)) return id;
	}
	return from;
}
