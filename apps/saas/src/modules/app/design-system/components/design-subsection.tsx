import { cn } from "@fuutu/utils/cn";
import type { ReactNode } from "react";

interface DesignSubsectionProps {
	title: ReactNode;
	description?: ReactNode;
	children: ReactNode;
	className?: string;
}

/** A titled block inside a design section (h3 + optional lead + content). */
export function DesignSubsection({
	title,
	description,
	children,
	className,
}: DesignSubsectionProps) {
	return (
		<div className={cn("space-y-4", className)}>
			<div className="max-w-2xl space-y-1">
				<h3 className="font-bold font-heading text-base leading-6">{title}</h3>
				{description ? (
					<p className="text-muted-foreground text-sm leading-5">
						{description}
					</p>
				) : null}
			</div>
			{children}
		</div>
	);
}
