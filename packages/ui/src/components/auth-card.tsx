import { Fingerprint } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { Card, CardContent } from "./card";

export interface AuthCardProps {
	title: string;
	description?: string;
	children: ReactNode;
	footer?: ReactNode;
	className?: string;
}

export function AuthCard({
	title,
	description,
	children,
	footer,
	className,
}: AuthCardProps) {
	return (
		<div className={cn("flex flex-col gap-6", className)}>
			<Card className="overflow-hidden p-0">
				<CardContent className="grid p-0 md:grid-cols-2">
					<div className="p-6 md:p-8">
						<div className="flex flex-col items-center gap-2 text-center">
							<h1 className="font-bold text-2xl">{title}</h1>
							{description && (
								<p className="text-balance text-muted-foreground text-sm">
									{description}
								</p>
							)}
						</div>
						<div className="mt-6">{children}</div>
					</div>
					<div className="relative hidden md:block">
						{/* Brand-tinted gradient backdrop — deep violet fading to muted,
						    evokes the "secure vault" feeling for an auth surface. */}
						<div className="absolute inset-0 bg-linear-to-br from-primary/25 via-primary/10 to-muted" />
						{/* Subtle radial glow behind the icon for depth. */}
						<div className="absolute inset-0 bg-radial-[at_50%_45%] from-primary/20 to-transparent" />
						{/* Large centered fingerprint — the universal auth symbol. */}
						<div className="absolute inset-0 flex items-center justify-center">
							<Fingerprint
								className="size-32 text-primary/70"
								strokeWidth={1.25}
							/>
						</div>
					</div>
				</CardContent>
			</Card>
			{footer && (
				<div className="text-balance text-center text-muted-foreground text-xs [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
					{footer}
				</div>
			)}
		</div>
	);
}
