"use client";

import { Button } from "../button";
import type { LinkComponent, PricingTier } from "./types";

export function PricingCTA({
	tier,
	LinkComponent,
	size = "default",
	inverted = false,
}: {
	tier: PricingTier;
	LinkComponent?: LinkComponent;
	size?: "default" | "sm";
	inverted?: boolean;
}) {
	const variant = inverted ? "secondary" : "default";

	if (tier.onCtaClick) {
		return (
			<Button
				variant={variant}
				size={size}
				onClick={tier.onCtaClick}
				disabled={tier.disabled}
				className="w-full"
			>
				{tier.ctaLabel}
			</Button>
		);
	}
	if (tier.ctaHref) {
		const Link = LinkComponent;
		if (Link) {
			return (
				<Button variant={variant} size={size} className="w-full" asChild>
					<Link href={tier.ctaHref}>{tier.ctaLabel}</Link>
				</Button>
			);
		}
		return (
			<Button variant={variant} size={size} className="w-full" asChild>
				<a href={tier.ctaHref}>{tier.ctaLabel}</a>
			</Button>
		);
	}
	return (
		<Button variant={variant} size={size} disabled className="w-full">
			{tier.ctaLabel}
		</Button>
	);
}
