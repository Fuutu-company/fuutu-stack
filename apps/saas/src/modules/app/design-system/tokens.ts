import type { ContrastPair } from "@fuutu/ui/color";
import {
	Bell,
	Building2,
	CreditCard,
	FileText,
	KeyRound,
	Languages,
	LayoutDashboard,
	type LucideIcon,
	Palette,
	Settings,
	ShieldCheck,
	Users,
	Webhook,
} from "lucide-react";

/** Palette tokens by role group; `key` is the i18n key under `designSystem.foundations.palette.groups`. */
export const PALETTE_GROUPS = [
	{
		key: "surfaces",
		tokens: [
			"background",
			"foreground",
			"card",
			"card-foreground",
			"popover",
			"popover-foreground",
		],
	},
	{
		key: "actions",
		tokens: [
			"primary",
			"primary-foreground",
			"secondary",
			"secondary-foreground",
			"accent",
			"accent-foreground",
			"destructive",
		],
	},
	{
		key: "neutrals",
		tokens: ["muted", "muted-foreground", "border", "input", "ring"],
	},
	{
		key: "status",
		tokens: [
			"success",
			"success-foreground",
			"warning",
			"warning-foreground",
			"info",
			"info-foreground",
		],
	},
	{
		key: "areas",
		tokens: [
			"area-users",
			"area-users-foreground",
			"area-billing",
			"area-billing-foreground",
			"area-ai",
			"area-ai-foreground",
			"area-api",
			"area-api-foreground",
		],
	},
	{
		key: "charts",
		tokens: ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"],
	},
	{
		key: "sidebar",
		tokens: [
			"sidebar",
			"sidebar-foreground",
			"sidebar-primary",
			"sidebar-primary-foreground",
			"sidebar-accent",
			"sidebar-accent-foreground",
			"sidebar-border",
			"sidebar-ring",
		],
	},
] as const;

export type ContrastGroup =
	| "roles"
	| "textUse"
	| "areas"
	| "destructiveFill"
	| "primaryHover"
	| "primaryBand"
	| "focusRing"
	| "nonText";

/** Display order of the contrast groups; `key` doubles as the i18n key. */
export const CONTRAST_GROUPS: readonly ContrastGroup[] = [
	"roles",
	"textUse",
	"areas",
	"destructiveFill",
	"primaryHover",
	"primaryBand",
	"focusRing",
	"nonText",
];

/**
 * A surface and its own foreground (`card` + `card-foreground`) is a role
 * pair. `foreground` belongs to `background`.
 */
function isPartnerPair({ fg, bg }: ContrastPair): boolean {
	return fg === "foreground" ? bg === "background" : fg === `${bg}-foreground`;
}

export function contrastGroupOf(pair: ContrastPair): ContrastGroup {
	if (pair.effective === "destructive-fill") return "destructiveFill";
	if (pair.effective === "primary-hover-blend") return "primaryHover";
	if (pair.effective === "primary-band-tile") return "primaryBand";
	if (pair.effective === "focus-ring") return "focusRing";
	if (pair.fg.startsWith("area-")) return "areas";
	if (pair.min < 4.5) return "nonText";
	return isPartnerPair(pair) ? "roles" : "textUse";
}

export function contrastPairKey(pair: ContrastPair): string {
	const base = `${pair.fg}-on-${pair.bg}`;
	return pair.effective ? `${base}-${pair.effective}` : base;
}

/**
 * Type roles from DESIGN.md. Class strings are literal so Tailwind compiles
 * them; `sample` and `use` are i18n keys under `designSystem.foundations.type`.
 */
export const TYPE_ROLES = [
	{
		key: "display",
		spec: "font-heading text-6xl font-extrabold leading-[0.98] tracking-display",
		className:
			"font-heading text-6xl font-extrabold leading-[0.98] tracking-display",
	},
	{
		key: "h1",
		spec: "font-heading text-3xl md:text-4xl font-extrabold leading-tight tracking-heading",
		className:
			"font-heading text-3xl md:text-4xl font-extrabold leading-tight tracking-heading",
	},
	{
		key: "h2",
		spec: "font-heading text-xl font-bold leading-7 tracking-heading",
		className: "font-heading text-xl font-bold leading-7 tracking-heading",
	},
	{
		key: "h3",
		spec: "font-heading text-base font-bold leading-6",
		className: "font-heading text-base font-bold leading-6",
	},
	{
		key: "body",
		spec: "font-sans text-sm leading-6",
		className: "font-sans text-sm leading-6",
	},
	{
		key: "small",
		spec: "text-xs font-medium leading-4",
		className: "font-sans text-xs font-medium leading-4",
	},
	{
		key: "mono",
		spec: "text-sm font-normal leading-5",
		className: "font-mono text-sm font-normal leading-5",
	},
] as const;

/** Spacing steps in 4px units. `note` is true when the step has a documented role. */
export const SPACING_STEPS = [
	{ unit: 1, note: true },
	{ unit: 2, note: false },
	{ unit: 3, note: false },
	{ unit: 4, note: false },
	{ unit: 6, note: true },
	{ unit: 8, note: false },
	{ unit: 12, note: false },
	{ unit: 16, note: false },
] as const;

export const RADIUS_STEPS = [
	{ key: "sm", className: "rounded-sm" },
	{ key: "md", className: "rounded-md" },
	{ key: "lg", className: "rounded-lg" },
	{ key: "xl", className: "rounded-xl" },
	{ key: "2xl", className: "rounded-2xl" },
	{ key: "3xl", className: "rounded-3xl" },
	{ key: "4xl", className: "rounded-4xl" },
] as const;

/** Tactile elevation is shadow plus a faint ring, never a border. */
export const ELEVATION_LEVELS = [
	{ key: "2xs", className: "shadow-2xs ring-1 ring-foreground/5" },
	{ key: "xs", className: "shadow-xs ring-1 ring-foreground/5" },
	{ key: "sm", className: "shadow-sm ring-1 ring-foreground/5" },
	{ key: "md", className: "shadow-md ring-1 ring-foreground/5" },
	{ key: "lg", className: "shadow-lg ring-1 ring-foreground/5" },
	{ key: "xl", className: "shadow-xl ring-1 ring-foreground/5" },
	{ key: "2xl", className: "shadow-2xl ring-1 ring-foreground/5" },
] as const;

/** Lucide icons the app's navigation and settings already use. */
export const ICON_SET: readonly { name: string; icon: LucideIcon }[] = [
	{ name: "LayoutDashboard", icon: LayoutDashboard },
	{ name: "Settings", icon: Settings },
	{ name: "Users", icon: Users },
	{ name: "Building2", icon: Building2 },
	{ name: "CreditCard", icon: CreditCard },
	{ name: "Bell", icon: Bell },
	{ name: "KeyRound", icon: KeyRound },
	{ name: "Webhook", icon: Webhook },
	{ name: "ShieldCheck", icon: ShieldCheck },
	{ name: "Palette", icon: Palette },
	{ name: "FileText", icon: FileText },
	{ name: "Languages", icon: Languages },
];
