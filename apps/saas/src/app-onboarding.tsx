import type { AppOnboardingStep } from "./modules/app/onboarding/onboarding-steps";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * App onboarding wizard steps, merged into the kit steps
 * (`profile` → `organization` → `done`) by
 * `modules/app/onboarding/onboarding-wizard.tsx` — add yours here instead
 * of forking the wizard.
 *
 * - `id`: unique step id (not `profile`, `organization` or `done`).
 * - `after`: kit step to follow. Omitted, or `organization` while orgs
 *   are off, the step runs right before the final `done` step.
 * - `titleKey`: heading the wizard renders above the step, i18n key under
 *   `onboarding.*` (add it in every locale).
 * - `enabled`: static feature gate, e.g. `config.features.myFeature`.
 * - `Component`: renders the step body inside the wizard card (a client
 *   component — the wizard is one). Save your data, then call `onNext()`;
 *   `onBack()` returns to the previous step (the org step is skipped once
 *   the org was created in this flow). Persist through your own oRPC
 *   procedure; the kit only marks onboarding complete on `done`.
 *
 * These steps run on the client only — a signed-in user can skip them by
 * calling the completion action directly. Enforce every REQUIRED step
 * server-side in `app-onboarding.server.ts` (`appCanCompleteOnboarding`).
 *
 * ```tsx
 * export const appOnboardingSteps: readonly AppOnboardingStep[] = [
 *   { id: "role", after: "profile", titleKey: "role.heading", Component: RoleStep },
 * ];
 * ```
 */
export const appOnboardingSteps: readonly AppOnboardingStep[] = [];
