import type { ComponentType } from "react";

/**
 * Marketing-app extension contract — fill it in `src/app-marketing.tsx`
 * (navbar / footer links: `src/app-site-links.ts`). Every field is
 * optional; unset fields leave the kit marketing site unchanged.
 */

/** Kit home-page sections, top to bottom. */
export type HomeSectionKey =
	| "hero"
	| "integrations"
	| "features"
	| "product-tour"
	| "security"
	| "pricing"
	| "faq"
	| "cta";

/** One home-page section; rendered without props, in list order. */
export interface HomeSection<Key extends string = string> {
	key: Key;
	Component: ComponentType;
}

/**
 * Changes to the kit home sections, applied in this order:
 * `insert` → `replace` → `remove` (an insert anchored on a removed kit
 * section still lands at its position).
 */
export interface AppHomeSections {
	/**
	 * Extra sections: `after` a kit key (or an app key inserted before),
	 * appended when omitted or not found. A key that already exists throws.
	 */
	insert?: readonly (HomeSection & {
		after?: HomeSectionKey | (string & Record<never, never>);
	})[];
	/** Swap a kit section's component; it keeps its position. */
	replace?: Partial<Record<HomeSectionKey, ComponentType>>;
	/** Kit sections to drop. */
	remove?: readonly HomeSectionKey[];
}

export interface AppMarketing {
	/** Home page (`/`) composition. */
	homeSections?: AppHomeSections;
	/**
	 * Replace the kit pricing cards wherever `@marketing/pricing` is used:
	 * `Home` = home-page pricing section, `Page` = `/pricing` page.
	 */
	PricingCards?: {
		Home?: ComponentType;
		Page?: ComponentType;
	};
}
