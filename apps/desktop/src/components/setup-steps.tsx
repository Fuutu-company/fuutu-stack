"use client";

import { type PropsWithChildren, useEffect, useState } from "react";
import { appSetupSteps } from "@/app-setup-steps";
import {
	markStepDone,
	pendingSteps,
	phasesFor,
	readDoneSteps,
} from "@/lib/setup-steps";
import { GateScreen } from "./gate-screen";

/**
 * Runs your first-run steps (src/app-setup-steps.tsx) for a gate
 * decision, then renders `children` — the sign-in card for `sign_in`, the
 * app for `open` / `granted`. Steps only ever stand in front of what the
 * gate would show; they never unlock the app.
 */
export function SetupSteps({
	decision,
	children,
}: PropsWithChildren<{ decision: string }>) {
	const [done, setDone] = useState<Set<string> | null>(null);
	useEffect(() => setDone(readDoneSteps()), []);
	if (appSetupSteps.length === 0) return children;
	if (!done) return null;
	const [step] = pendingSteps(appSetupSteps, phasesFor(decision), done);
	if (!step) return children;
	const Step = step.Component;
	return (
		<GateScreen>
			<Step
				key={step.id}
				onDone={() =>
					setDone((current) => markStepDone(current ?? done, step.id))
				}
			/>
		</GateScreen>
	);
}
