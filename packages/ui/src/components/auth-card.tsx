import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export interface AuthCardProps {
	title: string;
	description?: string;
	children: ReactNode;
	footer?: ReactNode;
	/** A lower level when the card sits inside a page that already has its h1. */
	titleAs?: "h1" | "h2" | "h3" | "h4";
	className?: string;
}

export function AuthCard({
	title,
	description,
	children,
	footer,
	titleAs: Title = "h1",
	className,
}: AuthCardProps) {
	return (
		<div className={cn("flex w-full flex-col gap-6", className)}>
			<div
				data-slot="auth-card"
				className="rounded-3xl bg-card p-6 text-card-foreground shadow-md ring-1 ring-foreground/5 sm:p-8 md:p-9 dark:ring-foreground/10"
			>
				<div className="flex flex-col gap-1.5">
					<Title className="break-words font-extrabold font-heading text-3xl leading-tight tracking-heading">
						{title}
					</Title>
					{description && (
						<p className="text-pretty text-muted-foreground text-sm leading-6">
							{description}
						</p>
					)}
				</div>
				<div className="mt-6">{children}</div>
			</div>
			{footer && (
				<div className="text-balance text-center text-muted-foreground text-xs [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-foreground">
					{footer}
				</div>
			)}
		</div>
	);
}
