import type { MacFrameVariant } from "@fuutu/ui";
import type { LucideIcon } from "lucide-react";

/**
 * A single frame rendered inside any feature display component.
 * Use `imageSrc` / `videoSrc` / `iframeSrc` for real content,
 * or leave them blank to show the branded placeholder.
 */
export type FeatureFrame = {
	/** Colour variant of the placeholder gradient */
	variant?: MacFrameVariant;
	/** Render an iPhone shell instead of macOS chrome */
	iphone?: boolean;
	/** Path or URL to a screenshot */
	imageSrc?: string;
	/** Alt text for the image */
	imageAlt?: string;
	/** YouTube / direct video URL */
	videoSrc?: string;
	/** Live URL embedded via iframe */
	iframeSrc?: string;
};

/**
 * One feature entry.  Every display component reads this shape.
 */
export type FeatureItem = {
	/** Unique slug – used as React key, URL hash links, and i18n key prefix */
	id: string;
	/** Small icon component (Lucide) */
	icon: LucideIcon;
	/** One or more frames rendered in the visual area */
	frames: [FeatureFrame, ...FeatureFrame[]];
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * FEATURE CONFIG — edit here to update every display component at once.
 *
 * • `FeatureHero`    uses items[0]  (big single-frame showcase)
 * • `FeatureRow`     uses items[1..3] (3-column clickable chrome row)
 * • `FeatureShowcase` uses items[4..N] (left list + stacked frames on right)
 *
 * You can override which slice each component receives via its `items` prop.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
	Globe,
	LayoutDashboard,
	Lock,
	Package,
	ShieldCheck,
	Zap,
} from "lucide-react";

export const FEATURES: FeatureItem[] = [
	// ── Hero feature (FeatureHero) ───────────────────────────────────────────
	{
		id: "dashboard",
		icon: LayoutDashboard,
		frames: [
			{
				variant: "primary",
			},
		],
	},

	// ── Row features (FeatureRow) — 3 items ──────────────────────────────────
	{
		id: "auth",
		icon: Lock,
		frames: [
			{
				variant: "violet",
			},
		],
	},
	{
		id: "payments",
		icon: Zap,
		frames: [
			{
				variant: "emerald",
			},
		],
	},
	{
		id: "i18n",
		icon: Globe,
		frames: [
			{
				variant: "amber",
			},
		],
	},

	// ── Showcase features (FeatureShowcase) — N items ────────────────────────
	{
		id: "rbac",
		icon: ShieldCheck,
		frames: [
			{
				variant: "primary",
			},
			{
				variant: "primary",
				iphone: true,
			},
		],
	},
	{
		id: "api",
		icon: Package,
		frames: [
			{
				variant: "violet",
			},
			{
				variant: "violet",
				iphone: true,
			},
		],
	},
	{
		id: "providers",
		icon: Package,
		frames: [
			{
				variant: "rose",
			},
		],
	},
];
