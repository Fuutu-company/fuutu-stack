import type { AppSlots } from "./modules/app/slots";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Components the kit renders at fixed places in its SaaS pages (contract
 * and placement: `modules/app/slots.ts`) — add your UI here instead of
 * editing the pages:
 *
 * - `userSettings({ tab })`: `/settings`, below the active section
 * - `orgBillingTop({ slug })` / `orgBillingBottom({ slug })`: org billing
 *   page, above / below the kit billing view
 * - `dashboard({ orgSlug })`: personal and org dashboards, below the kit
 *   widgets
 *
 * Unset slots render nothing. Slots receive only routing data — load
 * your own data with org-scoped queries and re-check access there; the
 * host page's guard is not a substitute. Strings via `useTranslations` /
 * `getTranslations` (no literals).
 *
 * ```tsx
 * export const appSlots: AppSlots = {
 *   dashboard: ({ orgSlug }) => <UsageCard orgSlug={orgSlug} />,
 * };
 * ```
 */
export const appSlots: AppSlots = {};
