import type { ComponentType } from "react";

/**
 * - `pre-auth`: before sign-in (shown in front of the sign-in card) — e.g.
 *   language, a welcome; it can never reach the app.
 * - `post-auth`: after sign-in (or when the app needs none), before the
 *   shell — e.g. a product tour, initial preferences.
 */
export type SetupPhase = "pre-auth" | "post-auth";

/** One first-run step of your app (`src/app-setup-steps.tsx`). */
export type AppSetupStep = {
	/** Unique, stable — completion is remembered per id on this device. */
	id: string;
	phase: SetupPhase;
	/** Call `onDone()` to finish the step (shown once per device). */
	Component: ComponentType<{ onDone: () => void }>;
};

/**
 * Phases the access gate runs for a decision: pre-auth steps in front of
 * sign-in only; both before the app once access is granted (or open). No
 * other gate state (no plan, device limit, …) shows app-provided UI.
 */
export function phasesFor(decision: string): SetupPhase[] {
	if (decision === "sign_in") return ["pre-auth"];
	if (decision === "granted" || decision === "open") {
		return ["pre-auth", "post-auth"];
	}
	return [];
}

/** Steps of `phases` not done yet: phase order, then declaration order. */
export function pendingSteps(
	steps: readonly AppSetupStep[],
	phases: readonly SetupPhase[],
	done: ReadonlySet<string>,
): AppSetupStep[] {
	const ids = new Set<string>();
	for (const step of steps) {
		if (ids.has(step.id)) {
			throw new Error(`app-setup-steps.tsx: duplicate step id "${step.id}"`);
		}
		ids.add(step.id);
	}
	return phases.flatMap((phase) =>
		steps.filter((step) => step.phase === phase && !done.has(step.id)),
	);
}

const STORAGE_KEY = "desktop.setup.done";

/** Ids of the steps finished on this device (empty without storage). */
export function readDoneSteps(): Set<string> {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		const list: unknown = raw ? JSON.parse(raw) : [];
		return new Set(
			Array.isArray(list)
				? list.filter((id): id is string => typeof id === "string")
				: [],
		);
	} catch {
		return new Set();
	}
}

export function markStepDone(
	done: ReadonlySet<string>,
	id: string,
): Set<string> {
	const next = new Set(done).add(id);
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
	} catch {
		// storage unavailable — the step shows again next start
	}
	return next;
}
