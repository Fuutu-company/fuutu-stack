import type { MacFrameVariant } from "./types";

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
