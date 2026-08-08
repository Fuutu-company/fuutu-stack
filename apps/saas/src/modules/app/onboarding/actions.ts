"use server";

import { setOnboardingComplete } from "@fuutu/db";
import { requireAuth } from "@/lib/auth-server";

/**
 * Mark the current user's onboarding as complete. The `onboardingComplete`
 * field has `input: false` in the Better-Auth additionalFields config (so
 * clients can't flip it via `updateUser`); flipping happens server-side
 * after the wizard finishes.
 */
export async function completeOnboardingAction(): Promise<void> {
	const session = await requireAuth();
	await setOnboardingComplete(session.user.id);
}
