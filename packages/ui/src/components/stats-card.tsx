import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

interface StatsCardProps {
	title: string;
	value: string;
	description?: string;
	icon?: LucideIcon;
	trend?: {
		value: number;
		label: string;
		direction: "up" | "down";
	};
	className?: string;
}

export function StatsCard({
	title,
	value,
	description,
	icon: Icon,
	trend,
	className,
}: StatsCardProps) {
	return (
		<Card className={className} data-testid="stat-card">
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="font-medium text-sm">{title}</CardTitle>
				{Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
			</CardHeader>
			<CardContent>
				<div className="font-bold text-2xl" data-testid="stat-value">
					{value}
				</div>
				{description && (
					<p className="text-muted-foreground text-xs">{description}</p>
				)}
				{trend && (
					<div className="mt-2 flex items-center gap-1 text-xs">
						{trend.direction === "up" ? (
							<ArrowUp className="h-3 w-3 text-success" />
						) : (
							<ArrowDown className="h-3 w-3 text-destructive" />
						)}
						<span
							className={cn(
								"font-medium",
								trend.direction === "up" ? "text-success" : "text-destructive",
							)}
						>
							{trend.value}%
						</span>
						<span className="text-muted-foreground">{trend.label}</span>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
