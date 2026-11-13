"use client";

import { Check, ChevronRight } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils";
import { AreaBadge, AreaIcon } from "../area";
import { BillingToggle } from "./billing-toggle";
import { PricingCTA } from "./pricing-cta";
import { PRICE_CLASS, tierSurfaceClass } from "./surface";
import type { PricingCompactProps, PricingTier } from "./types";
import { resolveTierDisplay, safeHref } from "./utils";

/**
 * Home-page pricing variant.
 *
 * Layout:
 *   - Billing period toggle (monthly / yearly) above the grid.
 *   - Regular plans side-by-side in a grid.
 *   - Enterprise tier rendered as a full-width banner below.
 *
 * The compact feature list is curated by the caller via `tier.features` (first 4 shown).
 * Below the list: "…and X more. See all →" link to pricingHref.
 */
export function PricingCompact({
	tiers,
	className,
	popularLabel,
	moreLabel,
	pricingHref,
	seeAllLabel,
	enterpriseHighlights,
	seatLabel,
	LinkComponent,
	monthlyLabel,
	yearlyLabel,
	yearlyBadge,
}: PricingCompactProps) {
	const [isYearly, setIsYearly] = React.useState(false);
	const regular = tiers.filter((t) => t.price !== "—");
	const enterprise = tiers.find((t) => t.price === "—");
	const hasYearly = regular.some((t) => t.yearlyPrice);

	return (
		<div className={cn("relative w-full", className)}>
			{hasYearly && (
				<BillingToggle
					isYearly={isYearly}
					setIsYearly={setIsYearly}
					monthlyLabel={monthlyLabel}
					yearlyLabel={yearlyLabel}
					yearlyBadge={yearlyBadge}
				/>
			)}

			<div
				className={cn(
					"grid auto-rows-fr gap-5",
					regular.length === 2 && "md:grid-cols-2",
					regular.length >= 3 && "md:grid-cols-2 lg:grid-cols-3",
				)}
			>
				{regular.map((tier) => (
					<RegularCard
						key={tier.id}
						tier={tier}
						isYearly={isYearly}
						popularLabel={popularLabel}
						totalFeatures={tier.featureIds?.length ?? tier.features.length}
						moreLabel={moreLabel}
						pricingHref={pricingHref}
						seeAllLabel={seeAllLabel}
						seatLabel={seatLabel}
						LinkComponent={LinkComponent}
					/>
				))}
			</div>

			{enterprise && (
				<EnterpriseBanner
					tier={enterprise}
					highlights={enterpriseHighlights}
					LinkComponent={LinkComponent}
				/>
			)}
		</div>
	);
}

// ─── Regular Plan Card ────────────────────────────────────────────────────────

function RegularCard({
	tier,
	isYearly,
	popularLabel,
	totalFeatures,
	moreLabel,
	pricingHref,
	seeAllLabel,
	seatLabel,
	LinkComponent,
}: {
	tier: PricingTier;
	isYearly: boolean;
	popularLabel?: string;
	totalFeatures: number;
	moreLabel?: string;
	pricingHref?: string;
	seeAllLabel?: string;
	seatLabel?: (seatCount: number) => string;
	LinkComponent?: PricingCompactProps["LinkComponent"];
}) {
	const hl = tier.highlighted;
	const Icon = tier.icon;
	const shown = tier.features.slice(0, 4);
	const remaining = totalFeatures - shown.length;
	const { price: displayPrice, suffix: displaySuffix } = resolveTierDisplay(
		tier,
		isYearly,
	);

	return (
		<div
			data-slot="pricing-tier"
			data-highlighted={hl ? "" : undefined}
			className={tierSurfaceClass(hl, "h-full min-h-0 p-6 md:p-8")}
		>
			<div className="mb-6 flex min-h-7 items-center justify-between gap-3">
				<div className="flex items-center gap-2.5">
					{Icon && (
						<AreaIcon area="billing" size="sm">
							<Icon />
						</AreaIcon>
					)}
					<h3 className="font-bold font-heading text-lg tracking-heading">
						{tier.name}
					</h3>
				</div>
				{hl && popularLabel && (
					<AreaBadge area="billing">{popularLabel}</AreaBadge>
				)}
			</div>

			<div className="mb-6">
				<div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
					<span className={PRICE_CLASS}>{displayPrice}</span>
					{displaySuffix && (
						<span className="text-muted-foreground text-sm">
							{displaySuffix}
						</span>
					)}
					{tier.seatCount && seatLabel && (
						<span className="text-muted-foreground text-xs">
							{seatLabel(tier.seatCount)}
						</span>
					)}
				</div>
				{tier.description && (
					<p className="mt-2 text-muted-foreground text-sm leading-6">
						{tier.description}
					</p>
				)}
			</div>

			<ul className="mb-5 space-y-2.5 text-sm">
				{shown.map((f) => (
					<li key={f} className="flex items-start gap-2.5">
						<Check
							aria-hidden="true"
							className="mt-0.5 size-4 shrink-0 text-area-billing-foreground"
						/>
						<span>{f}</span>
					</li>
				))}
			</ul>

			{remaining > 0 && pricingHref && moreLabel && seeAllLabel && (
				<SeeAllLink
					remaining={remaining}
					moreLabel={moreLabel}
					seeAllLabel={seeAllLabel}
					href={pricingHref}
					LinkComponent={LinkComponent}
				/>
			)}

			<div className="mt-auto pt-6">
				<PricingCTA
					tier={tier}
					LinkComponent={LinkComponent}
					variant={hl ? "default" : "outline"}
					isYearly={isYearly}
				/>
			</div>
		</div>
	);
}

// ─── Enterprise Banner ────────────────────────────────────────────────────────

function EnterpriseBanner({
	tier,
	highlights,
	LinkComponent,
}: {
	tier: PricingTier;
	highlights?: { label: string; description: string }[];
	LinkComponent?: PricingCompactProps["LinkComponent"];
}) {
	const Icon = tier.icon;
	return (
		<div
			className={tierSurfaceClass(
				tier.highlighted,
				"mt-5 gap-8 rounded-3xl p-6 md:flex-row md:items-center md:gap-12 md:p-10",
			)}
		>
			<div className="shrink-0 md:w-64">
				<div className="mb-5 flex items-center gap-2.5">
					{Icon && (
						<AreaIcon area="billing" size="sm">
							<Icon />
						</AreaIcon>
					)}
					<h3 className="font-bold font-heading text-lg tracking-heading">
						{tier.name}
					</h3>
				</div>
				{tier.description && (
					<p className="max-w-xs text-muted-foreground text-sm leading-6">
						{tier.description}
					</p>
				)}
				<div className="mt-6">
					<PricingCTA
						tier={tier}
						LinkComponent={LinkComponent}
						variant={tier.highlighted ? "default" : "outline"}
					/>
				</div>
			</div>

			{highlights && highlights.length > 0 && (
				<div className="grid flex-1 gap-3 sm:grid-cols-2">
					{highlights.map((h) => (
						<div
							key={h.label}
							className="flex items-start gap-3 rounded-2xl bg-muted p-4"
						>
							<Check
								aria-hidden="true"
								className="mt-0.5 size-4 shrink-0 text-area-billing-foreground"
							/>
							<div>
								<p className="font-semibold text-sm">{h.label}</p>
								<p className="mt-0.5 text-muted-foreground text-xs leading-5">
									{h.description}
								</p>
							</div>
						</div>
					))}
				</div>
			)}

			{!highlights && tier.features.length > 0 && (
				<ul className="flex flex-1 flex-wrap gap-x-8 gap-y-3">
					{tier.features.map((f) => (
						<li key={f} className="flex items-center gap-2.5 text-sm">
							<Check
								aria-hidden="true"
								className="size-4 shrink-0 text-area-billing-foreground"
							/>
							<span>{f}</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

// ─── "See all" link ───────────────────────────────────────────────────────────

function SeeAllLink({
	remaining,
	moreLabel,
	seeAllLabel,
	href,
	LinkComponent,
}: {
	remaining: number;
	moreLabel: string;
	seeAllLabel: string;
	href: string;
	LinkComponent?: PricingCompactProps["LinkComponent"];
}) {
	const cls =
		"mb-1 flex w-fit items-center gap-1 text-muted-foreground text-xs underline-offset-4 transition-colors hover:text-foreground hover:underline";
	const content = (
		<>
			+{remaining} {moreLabel} · {seeAllLabel}
			<ChevronRight aria-hidden="true" className="size-3 shrink-0" />
		</>
	);
	const safe = safeHref(href);
	const Link = LinkComponent;
	if (Link)
		return (
			<Link href={safe} className={cls}>
				{content}
			</Link>
		);
	return (
		<a href={safe} className={cls}>
			{content}
		</a>
	);
}
