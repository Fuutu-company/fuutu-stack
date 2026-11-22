import {
	type ComponentType,
	createElement,
	type ReactElement,
	type ReactNode,
} from "react";

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
	/**
	 * Dashboards: REPLACES the kit's demo widgets (`DashboardOverview`)
	 * when set; `dashboard` still renders below it. `firstName` is null
	 * when the user has no name.
	 */
	dashboardMain?: ComponentType<{
		orgSlug: string | null;
		userId: string;
		firstName: string | null;
	}>;
	/**
	 * Desktop app top bar: right before the notification bell, on every
	 * page of the signed-in shell. Rendered by the server layout, so it may
	 * be a server component; the mobile header shows nothing here.
	 */
	headerActions?: ComponentType;
	/**
	 * Auth pages (sign-in, sign-up, …): REPLACES the logo mark next to the
	 * app name above the card (kit: `BrandLogo` inverted in dark mode).
	 */
	authLogo?: ComponentType;
}

/**
 * Element for a slot, or `fallback` (default `null`) when the app left it
 * unset — host pages render every slot through this:
 * `{renderSlot(appSlots.dashboard, { orgSlug })}`. A replacing slot passes
 * the kit content as `fallback`.
 */
export function renderSlot<P extends object>(
	Slot: ComponentType<P> | undefined,
	props: P,
	fallback: ReactNode = null,
): ReactElement<P> | ReactNode {
	return Slot ? createElement(Slot, props) : fallback;
}
