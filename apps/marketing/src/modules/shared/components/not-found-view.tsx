import { AreaBackdrop, Badge } from "@fuutu/ui";
import { cn } from "@fuutu/utils/cn";
import type { ReactNode } from "react";
import { PageIntro } from "./page-intro";

interface NotFoundViewProps {
	code: string;
	title: string;
	description: string;
	/** The ink "back home" button — a locale-aware link or a plain anchor. */
	action: ReactNode;
	className?: string;
}

/** Shared 404 body for the root and the locale `not-found` files. */
export function NotFoundView({
	code,
	title,
	description,
	action,
	className,
}: NotFoundViewProps) {
	return (
		<div
			className={cn(
				"relative isolate flex items-center justify-center overflow-hidden px-4 py-16 sm:px-6",
				className,
			)}
		>
			<AreaBackdrop />
			<PageIntro
				align="center"
				before={
					<Badge variant="secondary" className="font-mono">
						{code}
					</Badge>
				}
				title={title}
				description={description}
			>
				<div className="mt-3">{action}</div>
			</PageIntro>
		</div>
	);
}
