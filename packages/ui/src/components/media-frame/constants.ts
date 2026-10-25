import type { MacFrameVariant } from "./types";

/**
 * Device chrome colors intentionally mimic real Apple hardware —
 * deliberate hardware-simulation exception to the "no raw colors" rule
 * in ui.md. Do NOT map these to semantic theme tokens.
 */
export const DEVICE_CHROME = {
	trafficClose: "#ff5f57",
	trafficMinimize: "#febc2e",
	trafficMaximize: "#28c840",
	macTitlebarBg: "#ececee",
	macTitlebarBorder: "#d2d2d7",
	macTitlebarBgDark: "#3a3a3c",
	macTitlebarBorderDark: "#38383a",
	iphoneSideButton: "#52525b",
	iphoneScreen: "#000000",
	iphoneShellGradient:
		"linear-gradient(145deg, #4a4a4a 0%, #1a1a1a 40%, #2d2d2d 70%, #111 100%)",
	iphoneDropShadow: "0 30px 80px -10px rgba(0, 0, 0, 0.6)",
	iphoneIsland: "#0a0a0a",
	iphoneIslandHighlight: "rgba(255, 255, 255, 0.08)",
	iphoneHomeIndicator: "rgba(255, 255, 255, 0.3)",
	iphoneGloss: "linear-gradient(180deg, #fff 0%, transparent 100%)",
} as const;

/**
 * The violet/emerald/amber/rose variants are a deliberate categorical
 * palette — the variant names ARE the color contract, so they keep their
 * literal Tailwind colors rather than mapping to semantic tokens (paired
 * white/opacity label colors are part of the same exception).
 */
export const VARIANT_BG: Record<MacFrameVariant, string> = {
	default: "bg-muted",
	primary: "bg-primary",
	violet: "bg-violet-500",
	emerald: "bg-emerald-500",
	amber: "bg-amber-400",
	rose: "bg-rose-500",
};

export const VARIANT_LABEL: Record<MacFrameVariant, string> = {
	default: "text-foreground/40",
	primary: "text-primary-foreground/50",
	violet: "text-white/50",
	emerald: "text-white/50",
	amber: "text-white/50",
	rose: "text-white/50",
};

export const VARIANT_ICON: Record<MacFrameVariant, string> = {
	default: "text-foreground/25",
	primary: "text-primary-foreground/40",
	violet: "text-white/40",
	emerald: "text-white/40",
	amber: "text-white/40",
	rose: "text-white/40",
};
