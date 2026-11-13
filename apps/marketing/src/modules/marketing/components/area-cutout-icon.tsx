import { AREA_CLASSES, type Area } from "@fuutu/ui";
import { cn } from "@fuutu/utils/cn";
import type { LucideIcon } from "lucide-react";

interface AreaCutoutIconProps {
	area: Area;
	icon: LucideIcon;
	/**
	 * Text color class matching the surface the icon sits on — the strokes
	 * are drawn in it, so the surface appears to cut into the tile.
	 */
	surfaceClassName?: string;
	className?: string;
}

/**
 * A solid area tile with its icon "cut out": the icon is drawn in the
 * surrounding surface color and is larger than the tile, so its strokes run
 * past the tile edge and notch it. Decorative — pair it with visible text.
 */
export function AreaCutoutIcon({
	area,
	icon: Icon,
	surfaceClassName = "text-card",
	className,
}: AreaCutoutIconProps) {
	return (
		<span
			data-slot="cutout-icon"
			data-area={area}
			aria-hidden="true"
			className={cn("relative block size-10 shrink-0", className)}
		>
			<span
				data-slot="cutout-icon-tile"
				className={cn(
					"absolute inset-0 rounded-[0.8rem]",
					AREA_CLASSES[area].fill,
				)}
			/>
			<Icon
				strokeWidth={1.6}
				className={cn(
					"absolute top-1/2 left-1/2 size-[130%] -translate-x-1/2 -translate-y-1/2",
					surfaceClassName,
				)}
			/>
		</span>
	);
}
