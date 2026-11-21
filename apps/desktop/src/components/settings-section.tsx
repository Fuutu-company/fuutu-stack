import { Card } from "@fuutu/ui";
import type { PropsWithChildren, ReactNode } from "react";

/** One block of a settings page — the SaaS app's settings card. */
export function SettingsSection({
	title,
	description,
	actions,
	children,
}: PropsWithChildren<{
	title: string;
	description?: ReactNode;
	actions?: ReactNode;
}>) {
	return (
		<Card className="p-6 md:p-8">
			<section className="space-y-5">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="min-w-0 space-y-1">
						<h2 className="font-bold font-heading text-lg tracking-heading">
							{title}
						</h2>
						{description ? (
							<p className="text-muted-foreground text-sm">{description}</p>
						) : null}
					</div>
					{actions ? (
						<div className="flex flex-wrap items-center gap-2">{actions}</div>
					) : null}
				</div>
				{children}
			</section>
		</Card>
	);
}
