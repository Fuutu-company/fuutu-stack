"use client";

import { cn } from "../../lib/utils";
import { AreaBadge } from "../area";

export interface BillingToggleProps {
	isYearly: boolean;
	setIsYearly: (v: boolean) => void;
	monthlyLabel: string;
	yearlyLabel: string;
	yearlyBadge?: string;
}

const OPTION =
	"inline-flex h-9 items-center gap-2 rounded-full px-4 font-semibold text-sm outline-none transition-[color,background-color,box-shadow] duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none";
const ACTIVE = "bg-card text-foreground shadow-sm";
const IDLE = "text-muted-foreground hover:text-foreground";

/** Monthly / yearly switch, styled as the Tabs pill. */
export function BillingToggle({
	isYearly,
	setIsYearly,
	monthlyLabel,
	yearlyLabel,
	yearlyBadge,
}: BillingToggleProps) {
	return (
		<div className="mb-10 flex items-center justify-center">
			<div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
				<button
					type="button"
					aria-pressed={!isYearly}
					onClick={() => setIsYearly(false)}
					className={cn(OPTION, isYearly ? IDLE : ACTIVE)}
				>
					{monthlyLabel}
				</button>
				<button
					type="button"
					aria-pressed={isYearly}
					onClick={() => setIsYearly(true)}
					className={cn(OPTION, isYearly ? ACTIVE : IDLE)}
				>
					{yearlyLabel}
					{yearlyBadge && (
						<AreaBadge area="billing" className="h-5 px-2 text-[11px]">
							{yearlyBadge}
						</AreaBadge>
					)}
				</button>
			</div>
		</div>
	);
}
