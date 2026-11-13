import { cn } from "../../lib/utils";

/** Card surface of a pricing tier; the highlighted tier gets an ink ring. */
export function tierSurfaceClass(highlighted?: boolean, className?: string) {
	return cn(
		"relative flex flex-col rounded-2xl bg-card text-card-foreground",
		highlighted
			? "shadow-lg ring-2 ring-primary"
			: "shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10",
		className,
	);
}

/** Display price: heading font, heavy, tight, tabular figures. */
export const PRICE_CLASS =
	"font-extrabold font-heading text-4xl tabular-nums tracking-display";
