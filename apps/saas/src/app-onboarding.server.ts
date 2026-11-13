/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Server-side gate for finishing onboarding. `completeOnboardingAction`
 * (`modules/app/onboarding/actions.ts`) is a server action — anyone signed
 * in can call it directly and skip every wizard step, because the steps in
 * `app-onboarding.tsx` run on the client only. A step your app REQUIRES
 * must therefore be enforced here: return `false` while its data is
 * missing and the action refuses (the wizard shows `onboarding.incomplete`).
 *
 * `undefined` (default) allows completion. Server-only: read your data
 * through `@fuutu/db` query functions.
 *
 * ```ts
 * export const appCanCompleteOnboarding: AppCanCompleteOnboarding = async (
 *   userId,
 * ) => (await getUserRole(userId)) !== null;
 * ```
 */
export type AppCanCompleteOnboarding = (userId: string) => Promise<boolean>;

export const appCanCompleteOnboarding: AppCanCompleteOnboarding | undefined =
	undefined;
