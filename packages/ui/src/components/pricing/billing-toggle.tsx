"use client";

import { cn } from "../../lib/utils";

export interface BillingToggleProps {
	isYearly: boolean;
	setIsYearly: (v: boolean) => void;
	monthlyLabel: string;
	yearlyLabel: string;
	yearlyBadge?: string;
}

export function BillingToggle({
	isYearly,
	setIsYearly,
	monthlyLabel,
	yearlyLabel,
	yearlyBadge,
}: BillingToggleProps) {
	return (
		<div className="mb-10 flex items-center justify-center gap-3">
			<div className="relative inline-flex items-center rounded-full bg-secondary/80 p-1">
				<button
					type="button"
					onClick={() => setIsYearly(false)}
					className={cn(
						"relative z-10 rounded-full px-5 py-2 font-medium text-sm transition-all",
						!isYearly
							? "bg-primary text-primary-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					{monthlyLabel}
				</button>
				<button
					type="button"
					onClick={() => setIsYearly(true)}
					className={cn(
						"relative z-10 rounded-full px-5 py-2 font-medium text-sm transition-all",
						isYearly
							? "bg-primary text-primary-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					{yearlyLabel}
					{yearlyBadge && (
						<span className="absolute -top-1 -right-1 rounded-full bg-primary px-1 py-px font-medium text-[8px] text-primary-foreground leading-tight">
							{yearlyBadge}
						</span>
					)}
				</button>
			</div>
		</div>
	);
}
