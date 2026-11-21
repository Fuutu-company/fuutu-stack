import type { AppSetupStep } from "@/lib/setup-steps";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * First-run steps of your desktop app, run by the kit's access gate
 * (`components/setup-steps.tsx`), once per device:
 *
 * - `phase: "pre-auth"` — in front of the sign-in card (e.g. choose the
 *   language: `useDesktopLocale()` from `components/intl-provider`). A
 *   pre-auth step never reaches the app; sign-in still follows.
 * - `phase: "post-auth"` — after sign-in (or when the app needs none),
 *   before the shell.
 *
 * Each step is a client component that calls `onDone()` when finished;
 * it renders centred in the window.
 *
 * ```tsx
 * import { LanguageStep } from "@/modules/setup/language-step";
 * export const appSetupSteps: AppSetupStep[] = [
 *   { id: "language", phase: "pre-auth", Component: LanguageStep },
 * ];
 * ```
 */
export const appSetupSteps: AppSetupStep[] = [];
