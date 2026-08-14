import type * as React from "react";

export interface PricingTier {
	id: string;
	name: string;
	description?: string;
	price: string;
	priceSuffix?: string;
	/** Optional yearly price shown when billing toggle is switched to yearly. */
	yearlyPrice?: string;
	yearlyPriceSuffix?: string;
	/** Localized feature label strings for compact display. */
	features: string[];
	/** Parallel array of catalog feature IDs — for matrix/tooltip rendering. */
	featureIds?: string[];
	highlighted?: boolean;
	ctaLabel: string;
	ctaHref?: string;
	onCtaClick?: () => void;
	disabled?: boolean;
	/** Optional Lucide-style icon rendered as plan identity mark. */
	icon?: React.ComponentType<{ className?: string }>;
	/** Seat count for seat-based plans (e.g. "5 seats"). */
	seatCount?: number;
}

/**
 * A feature row in the full comparison matrix (pricing page variant).
 * `values` keyed by tier id: true = included, false = not included, string = limit label.
 */
export interface FeatureMatrixRow {
	id: string;
	label: string;
	/** Short description shown in tooltip. */
	tooltip?: string;
	/** Optional video URL — opens a MediaFrame dialog when clicked. */
	videoSrc?: string;
	group?: string;
	values: Record<string, boolean | string>;
}

export type LinkComponent = React.ComponentType<{
	href: string;
	children: React.ReactNode;
	className?: string;
}>;

export interface PricingCompactProps {
	/** All tiers — enterprise (billingType:"custom") auto-detected and rendered as banner. */
	tiers: PricingTier[];
	className?: string;
	popularLabel?: string;
	/** Localized "…and N more features" suffix for the compact list. */
	moreLabel?: string;
	/** href to the full pricing page (used in "see all" link inside compact cards). */
	pricingHref?: string;
	/** Localized "See all" link label. */
	seeAllLabel?: string;
	/** Localized labels for Enterprise highlights (shown in the full-width banner). */
	enterpriseHighlights?: { label: string; description: string }[];
	LinkComponent?: LinkComponent;
	/** Localized label for the monthly billing toggle option. */
	monthlyLabel?: string;
	/** Localized label for the yearly billing toggle option. */
	yearlyLabel?: string;
	/** Optional badge text shown on the yearly toggle (e.g. "Save 20%"). */
	yearlyBadge?: string;
}

export interface PricingFullProps {
	tiers: PricingTier[];
	featureMatrix: FeatureMatrixRow[];
	featureGroupLabels?: Record<string, string>;
	className?: string;
	popularLabel?: string;
	/** Localized "Watch demo" label shown on features that have videoSrc. */
	watchLabel?: string;
	/** Replaces "—" display prices (e.g. enterprise custom pricing). Defaults to "Custom". */
	customPriceLabel?: string;
	LinkComponent?: LinkComponent;
	/** Localized label for the monthly billing toggle option. */
	monthlyLabel?: string;
	/** Localized label for the yearly billing toggle option. */
	yearlyLabel?: string;
	/** Optional badge text shown on the yearly toggle (e.g. "Save 20%"). */
	yearlyBadge?: string;
}
