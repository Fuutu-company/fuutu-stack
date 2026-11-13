import { type ComponentType, createElement, type ReactElement } from "react";

/**
 * Render slots the kit leaves in its SaaS pages — fill them in
 * `apps/saas/src/app-slots.tsx`. Every slot is optional; an unset slot
 * renders nothing. Slot components may be server components (async) or
 * client components; the host pages are server components.
 */
export interface AppSlots {
	/** `/settings`: rendered below the active section, for every tab. */
	userSettings?: ComponentType<{ tab: string }>;
	/** Org billing page (`/organizations/<slug>/settings/billing`): above the plans. */
	orgBillingTop?: ComponentType<{ slug: string }>;
	/** Org billing page: below the plans and invoices. */
	orgBillingBottom?: ComponentType<{ slug: string }>;
	/** Dashboards: below the kit widgets; `orgSlug` is null on the personal dashboard. */
	dashboard?: ComponentType<{ orgSlug: string | null }>;
}

/**
 * Element for a slot, or `null` when the app left it unset — host pages
 * render every slot through this: `{renderSlot(appSlots.dashboard, { orgSlug })}`.
 */
export function renderSlot<P extends object>(
	Slot: ComponentType<P> | undefined,
	props: P,
): ReactElement<P> | null {
	return Slot ? createElement(Slot, props) : null;
}
