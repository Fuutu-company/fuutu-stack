"use client";

import { Button } from "../button";
import type { LinkComponent, PricingTier } from "./types";
import { safeHref } from "./utils";

export function PricingCTA({
	tier,
	LinkComponent,
	size = "default",
	inverted = false,
	isYearly = false,
}: {
	tier: PricingTier;
	LinkComponent?: LinkComponent;
	size?: "default" | "sm";
	inverted?: boolean;
	/** Whether the billing toggle is on yearly — forwarded to onCtaClick as the interval. */
	isYearly?: boolean;
}) {
	const variant = inverted ? "secondary" : "default";
	// Emit "year" only when this tier actually has a yearly price — a
	// yearly toggle must not sell a yearly interval for a monthly-only tier.
	const interval = isYearly && tier.yearlyPrice ? "year" : "month";

	if (tier.onCtaClick) {
		return (
			<Button
				variant={variant}
				size={size}
				onClick={() => tier.onCtaClick?.(interval)}
				disabled={tier.disabled}
				className="w-full"
			>
				{tier.ctaLabel}
			</Button>
		);
	}
	if (tier.ctaHref) {
		const href = safeHref(tier.ctaHref);
		const Link = LinkComponent;
		if (Link) {
			return (
				<Button variant={variant} size={size} className="w-full" asChild>
					<Link href={href}>{tier.ctaLabel}</Link>
				</Button>
			);
		}
		return (
			<Button variant={variant} size={size} className="w-full" asChild>
				<a href={href}>{tier.ctaLabel}</a>
			</Button>
		);
	}
	return (
		<Button variant={variant} size={size} disabled className="w-full">
			{tier.ctaLabel}
		</Button>
	);
}
