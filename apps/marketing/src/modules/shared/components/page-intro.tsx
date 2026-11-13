import { cn } from "@fuutu/utils/cn";
import type { ReactNode } from "react";

interface PageIntroProps {
	title: ReactNode;
	description?: ReactNode;
	/** Rendered above the title (back link, badge). */
	before?: ReactNode;
	/** Rendered below the description (meta line, actions). */
	children?: ReactNode;
	align?: "left" | "center";
	className?: string;
}

/** Display-size page header shared by every inner marketing page. */
export function PageIntro({
	title,
	description,
	before,
	children,
	align = "left",
	className,
}: PageIntroProps) {
	const centered = align === "center";
	return (
		<header
			className={cn(
				"flex flex-col gap-5",
				centered && "items-center text-center",
				className,
			)}
		>
			{before}
			<h1 className="max-w-4xl text-balance break-words font-extrabold font-heading text-[clamp(2.25rem,6vw,3.75rem)] leading-[1.02] tracking-display">
				{title}
			</h1>
			{description ? (
				<p
					className={cn(
						"max-w-2xl text-balance text-lg text-muted-foreground leading-8",
						centered && "mx-auto",
					)}
				>
					{description}
				</p>
			) : null}
			{children}
		</header>
	);
}
