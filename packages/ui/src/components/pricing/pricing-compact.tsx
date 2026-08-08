"use client";

import { Check, ChevronRight, Star } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils";
import { BillingToggle } from "./billing-toggle";
import { PricingCTA } from "./pricing-cta";
import type { PricingCompactProps, PricingTier } from "./types";

/**
 * Home-page pricing variant.
 *
 * Layout:
 *   - Billing period toggle (monthly / yearly) above the grid.
 *   - Regular plans side-by-side in a grid.
 *   - Enterprise tier rendered as a full-width premium banner below.
 *
 * The compact feature list is curated by the caller via `tier.features` (first 4 shown).
 * Below the list: "…and X more. See all →" link to pricingHref.
 */
export function PricingCompact({
	tiers,
	className,
	popularLabel,
	moreLabel = "more features",
	pricingHref,
	seeAllLabel = "See all features",
	enterpriseHighlights,
	LinkComponent,
	monthlyLabel = "Monthly",
	yearlyLabel = "Yearly",
	yearlyBadge,
}: PricingCompactProps) {
	const [isYearly, setIsYearly] = React.useState(false);
	const regular = tiers.filter((t) => t.price !== "—");
	const enterprise = tiers.find((t) => t.price === "—");
	const hasYearly = regular.some((t) => t.yearlyPrice);

	return (
		<div className={cn("relative w-full", className)}>
			{/* Ambient gradient */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 -z-10"
				style={{
					background:
						"radial-gradient(ellipse 70% 50% at 50% -5%, oklch(var(--primary)/0.12) 0%, transparent 65%)",
				}}
			/>

			{/* Billing toggle */}
			{hasYearly && (
				<BillingToggle
					isYearly={isYearly}
					setIsYearly={setIsYearly}
					monthlyLabel={monthlyLabel}
					yearlyLabel={yearlyLabel}
					yearlyBadge={yearlyBadge}
				/>
			)}

			{/* Regular plan cards */}
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
						LinkComponent={LinkComponent}
					/>
				))}
			</div>

			{/* Enterprise banner */}
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
	LinkComponent,
}: {
	tier: PricingTier;
	isYearly: boolean;
	popularLabel?: string;
	totalFeatures: number;
	moreLabel: string;
	pricingHref?: string;
	seeAllLabel: string;
	LinkComponent?: PricingCompactProps["LinkComponent"];
}) {
	const hl = tier.highlighted;
	const Icon = tier.icon;
	const shown = tier.features.slice(0, 4);
	const remaining = totalFeatures - shown.length;
	const displayPrice =
		isYearly && tier.yearlyPrice ? tier.yearlyPrice : tier.price;
	const displaySuffix =
		isYearly && tier.yearlyPriceSuffix
			? tier.yearlyPriceSuffix
			: tier.priceSuffix;

	return (
		<div
			className={cn(
				"group relative flex h-full min-h-0 flex-col rounded-2xl border p-6 transition-all duration-300 md:p-8",
				hl
					? "border-2 border-primary bg-primary text-primary-foreground shadow-xl"
					: "bg-card",
			)}
		>
			{/* Glow */}
			{hl && (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-6 -bottom-4 -z-10 h-16 blur-2xl"
					style={{ background: "oklch(var(--primary)/0.4)" }}
				/>
			)}

			{/* Popular badge */}
			{hl && popularLabel && (
				<span
					className={cn(
						"absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 font-medium text-xs",
						"bg-primary-foreground text-primary",
					)}
				>
					{popularLabel}
				</span>
			)}

			{/* Plan identity */}
			{Icon && (
				<div
					className={cn(
						"mb-5 flex items-center gap-2 font-mono text-xs",
						hl ? "text-primary-foreground" : "text-primary",
					)}
				>
					<Icon className="size-3.5 shrink-0" />
					{tier.name}
				</div>
			)}
			{!Icon && (
				<p
					className={cn(
						"mb-1 font-semibold text-sm",
						hl ? "text-primary-foreground/80" : "text-muted-foreground",
					)}
				>
					{tier.name}
				</p>
			)}

			{/* Price */}
			<div className="mb-5">
				<span
					className={cn(
						"font-bold text-4xl tracking-tight",
						hl ? "text-primary-foreground" : "text-foreground",
					)}
				>
					{displayPrice}
				</span>
				{displaySuffix && (
					<span
						className={cn(
							"ml-1.5 text-sm",
							hl ? "text-primary-foreground" : "text-muted-foreground",
						)}
					>
						{displaySuffix}
					</span>
				)}
				{tier.description && (
					<p
						className={cn(
							"mt-1.5 text-sm",
							hl ? "text-primary-foreground" : "text-muted-foreground",
						)}
					>
						{tier.description}
					</p>
				)}
			</div>

			{/* Feature list — curated 4, then "X more" link */}
			<ul className="mb-5 space-y-2.5 text-sm">
				{shown.map((f) => (
					<li key={f} className="flex items-start gap-2">
						<Check
							className={cn(
								"mt-0.5 size-4 shrink-0",
								hl ? "text-primary-foreground" : "text-primary",
							)}
						/>
						<span
							className={cn(
								hl ? "text-primary-foreground/90" : "text-foreground",
							)}
						>
							{f}
						</span>
					</li>
				))}
			</ul>

			{remaining > 0 && pricingHref && (
				<SeeAllLink
					remaining={remaining}
					moreLabel={moreLabel}
					seeAllLabel={seeAllLabel}
					href={pricingHref}
					inverted={hl}
					LinkComponent={LinkComponent}
				/>
			)}

			<div className="mt-auto pt-5">
				<PricingCTA tier={tier} LinkComponent={LinkComponent} inverted={hl} />
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
		<div className="relative mt-6 overflow-hidden rounded-3xl border border-primary/30 bg-card/80 shadow-lg ring-1 ring-primary/20 backdrop-blur-sm">
			{/* Stronger top shimmer line */}
			<div
				aria-hidden
				className="absolute inset-x-0 top-0 h-1"
				style={{
					background:
						"linear-gradient(90deg, transparent 0%, oklch(var(--primary)/0.5) 30%, oklch(var(--primary)/0.8) 50%, oklch(var(--primary)/0.5) 70%, transparent 100%)",
				}}
			/>
			{/* Premium radial glow */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 -z-10"
				style={{
					background:
						"radial-gradient(ellipse 80% 60% at 20% 40%, oklch(var(--primary)/0.10) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 85% 20%, oklch(var(--primary)/0.08) 0%, transparent 55%)",
				}}
			/>
			{/* Subtle bottom glow */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-8 -bottom-6 h-20 blur-3xl"
				style={{ background: "oklch(var(--primary)/0.15)" }}
			/>

			<div className="flex flex-col gap-8 p-8 md:flex-row md:items-center md:gap-12 md:p-10">
				{/* Left: identity + price + CTA */}
				<div className="shrink-0 md:w-64">
					{Icon && (
						<div className="mb-5 flex items-center gap-3">
							<div className="flex size-10 items-center justify-center rounded-2xl bg-linear-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
								<Icon className="size-5 text-primary" />
							</div>
							<div>
								<p className="font-semibold text-foreground">{tier.name}</p>
							</div>
						</div>
					)}
					{!Icon && (
						<div className="mb-4">
							<p className="font-semibold text-foreground">{tier.name}</p>
						</div>
					)}
					<p className="font-extrabold text-4xl text-foreground tracking-tighter">
						{tier.price}
					</p>
					{tier.description && (
						<p className="mt-2 max-w-xs text-muted-foreground text-sm leading-relaxed">
							{tier.description}
						</p>
					)}
					<div className="relative mt-5">
						<div
							aria-hidden
							className="pointer-events-none absolute inset-0 -z-10 rounded-md blur-lg"
							style={{ background: "oklch(var(--primary)/0.25)" }}
						/>
						<PricingCTA tier={tier} LinkComponent={LinkComponent} />
					</div>
				</div>

				{/* Divider */}
				<div className="hidden h-px w-full bg-border/60 md:block md:h-auto md:w-px md:shrink-0 md:self-stretch" />

				{/* Right: highlights grid */}
				{highlights && highlights.length > 0 && (
					<div className="grid flex-1 gap-5 sm:grid-cols-2">
						{highlights.map((h) => (
							<div
								key={h.label}
								className="flex items-start gap-3.5 rounded-2xl border border-border/40 bg-card/50 p-4"
							>
								<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
									<Star className="size-4 text-primary" />
								</div>
								<div>
									<p className="font-semibold text-foreground text-sm">
										{h.label}
									</p>
									<p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
										{h.description}
									</p>
								</div>
							</div>
						))}
					</div>
				)}

				{/* If no highlights: show feature list inline */}
				{!highlights && tier.features.length > 0 && (
					<ul className="flex flex-1 flex-wrap gap-x-8 gap-y-3">
						{tier.features.map((f) => (
							<li key={f} className="flex items-center gap-2.5 text-sm">
								<Check className="size-4 shrink-0 text-primary" />
								<span className="text-foreground">{f}</span>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

// ─── "See all" link ───────────────────────────────────────────────────────────

function SeeAllLink({
	remaining,
	moreLabel,
	seeAllLabel,
	href,
	inverted,
	LinkComponent,
}: {
	remaining: number;
	moreLabel: string;
	seeAllLabel: string;
	href: string;
	inverted?: boolean;
	LinkComponent?: PricingCompactProps["LinkComponent"];
}) {
	const cls = cn(
		"mb-1 flex items-center gap-1 text-xs transition-colors hover:underline",
		inverted
			? "text-primary-foreground/80 hover:text-primary-foreground"
			: "text-muted-foreground hover:text-foreground",
	);
	const content = (
		<>
			+{remaining} {moreLabel} · {seeAllLabel}
			<ChevronRight className="size-3 shrink-0" />
		</>
	);
	const Link = LinkComponent;
	if (Link)
		return (
			<Link href={href} className={cls}>
				{content}
			</Link>
		);
	return (
		<a href={href} className={cls}>
			{content}
		</a>
	);
}
