"use server";

import { setOnboardingComplete } from "@fuutu/db";
import { appCanCompleteOnboarding } from "@/app-onboarding.server";
import { requireAuth } from "@/lib/auth-server";

/**
 * Mark the current user's onboarding as complete. The `onboardingComplete`
 * field has `input: false` in the Better-Auth additionalFields config (so
 * clients can't flip it via `updateUser`); flipping happens server-side
 * after the wizard finishes. Client-only wizard steps can be skipped by
 * calling this directly — the app's `appCanCompleteOnboarding` hook
 * (`app-onboarding.server.ts`) enforces required steps; `{ ok: false }`
 * when it refuses.
 */
export async function completeOnboardingAction(): Promise<{ ok: boolean }> {
	const session = await requireAuth();
	if (
		appCanCompleteOnboarding &&
		!(await appCanCompleteOnboarding(session.user.id))
	) {
		return { ok: false };
	}
	await setOnboardingComplete(session.user.id);
	return { ok: true };
}
