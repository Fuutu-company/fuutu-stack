import { cn } from "@fuutu/utils/cn";
import type { ReactNode } from "react";

/** Centered landing section heading: display h2 plus an optional lead. */
export function SectionHeading({
	title,
	description,
	className,
}: {
	title: ReactNode;
	description?: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("mx-auto max-w-3xl text-center", className)}>
			<h2 className="text-balance font-extrabold font-heading text-[clamp(2.25rem,5.4vw,4rem)] leading-[1.02] tracking-display">
				{title}
			</h2>
			{description ? (
				<p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-muted-foreground leading-8 md:text-[1.1875rem]">
					{description}
				</p>
			) : null}
		</div>
	);
}

/** Soft, blurred area-colored blob for section backdrops. */
export function Blob({ className }: { className: string }) {
	return (
		<div
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute -z-10 rounded-full opacity-75 blur-[70px]",
				className,
			)}
		/>
	);
}
