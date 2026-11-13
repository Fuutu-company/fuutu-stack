import { cn } from "@fuutu/utils/cn";
import type { ReactNode } from "react";
import type { DesignSectionId } from "../sections";

/** `t.rich` tag map: renders `<code>…</code>` in translated copy as an inline code chip. */
export const richCode = {
	code: (chunks: ReactNode) => (
		<code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground">
			{chunks}
		</code>
	),
};

interface DesignSectionProps {
	id: DesignSectionId;
	/** 1-based position, shown as the section number. */
	index: number;
	title: ReactNode;
	description: ReactNode;
	children?: ReactNode;
}

export function DesignSection({
	id,
	index,
	title,
	description,
	children,
}: DesignSectionProps) {
	const titleId = `${id}-title`;
	return (
		<section
			id={id}
			aria-labelledby={titleId}
			// Focus target for the section nav; the margin clears the sticky nav (and the mobile header).
			tabIndex={-1}
			className={cn(
				"scroll-mt-32 space-y-6 outline-none md:scroll-mt-20",
				index > 1 && "border-t pt-10",
			)}
		>
			<div className="max-w-2xl space-y-1.5">
				<div className="flex items-baseline gap-3">
					<span
						aria-hidden="true"
						className="font-mono text-muted-foreground text-xs tabular-nums"
					>
						{String(index).padStart(2, "0")}
					</span>
					<h2
						id={titleId}
						className="font-bold font-heading text-xl leading-7 tracking-heading"
					>
						{title}
					</h2>
				</div>
				<p className="text-muted-foreground text-sm leading-6">{description}</p>
			</div>
			{children}
		</section>
	);
}
