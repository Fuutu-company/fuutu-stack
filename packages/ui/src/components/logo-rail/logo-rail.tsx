import { cn } from "../../lib/utils";
import { LogoItemCard } from "./logo-item";
import type { LogoRailProps } from "./types";

export function LogoRail({ items, className }: LogoRailProps) {
	return (
		<div className={cn("relative py-3", className)}>
			<div className="flex gap-2 sm:gap-3">
				{items.map((item) => (
					<LogoItemCard key={item.id} item={item} />
				))}
			</div>
		</div>
	);
}
