import { WCAG_AA } from "./color";

/**
 * A foreground/surface token pair that must reach `min` contrast (WCAG AA).
 * Token names are without the leading `--`. `effective: "destructive-fill"`
 * measures what destructive buttons and badges render: literal `text-white`
 * (`fg` is "white", not a token; `--destructive-foreground` is ignored) on a
 * solid fill in light and `destructive/60` in dark, composited over
 * background, card and popover. The worst ratio counts.
 * `effective: "primary-hover-blend"` measures `primary-foreground` on what
 * `hover:bg-primary/90` renders: primary at 90% over background.
 * `effective: "focus-ring"` measures what `ring-ring/50` renders: ring at
 * 50% over background, card and popover. The worst ratio counts.
 */
export type EffectiveKind =
	| "destructive-fill"
	| "primary-hover-blend"
	| "focus-ring";

export type ContrastPair = {
	fg: string;
	bg: string;
	min: number;
	effective?: EffectiveKind;
};

const text = (fg: string, bg: string): ContrastPair => ({
	fg,
	bg,
	min: WCAG_AA.text,
});
const ui = (fg: string, bg: string): ContrastPair => ({
	fg,
	bg,
	min: WCAG_AA.ui,
});

const TEXT_ON_SURFACES = ["background", "card"] as const;
const CHARTS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const;
/** Kit area tokens (brand.css block 3): `bg-area-<a>` fills with `text-area-<a>-foreground`. */
const AREAS = ["users", "billing", "ai", "api"] as const;

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
	text("foreground", "background"),
	text("card-foreground", "card"),
	text("popover-foreground", "popover"),
	text("primary-foreground", "primary"),
	text("secondary-foreground", "secondary"),
	text("muted-foreground", "muted"),
	text("accent-foreground", "accent"),
	text("sidebar-foreground", "sidebar"),
	text("sidebar-primary-foreground", "sidebar-primary"),
	text("sidebar-accent-foreground", "sidebar-accent"),
	text("success-foreground", "success"),
	text("warning-foreground", "warning"),
	text("info-foreground", "info"),
	...["muted-foreground", "primary", "destructive", "success"].flatMap((fg) =>
		TEXT_ON_SURFACES.map((bg) => text(fg, bg)),
	),
	{ ...text("white", "destructive"), effective: "destructive-fill" },
	{
		...text("primary-foreground", "primary"),
		effective: "primary-hover-blend",
	},
	...AREAS.flatMap((area) => [
		text(`area-${area}-foreground`, `area-${area}`),
		...TEXT_ON_SURFACES.map((bg) => text(`area-${area}-foreground`, bg)),
	]),
	ui("ring", "background"),
	{ ...ui("ring", "background"), effective: "focus-ring" },
	ui("sidebar-ring", "sidebar"),
	ui("input", "background"),
	ui("input", "card"),
	...CHARTS.flatMap((chart) => TEXT_ON_SURFACES.map((bg) => ui(chart, bg))),
];
