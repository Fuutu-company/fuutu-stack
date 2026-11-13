"use client";

import { Check, Info, Minus, Play } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils";
import { AreaBadge, AreaIcon } from "../area";
import { Button } from "../button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../dialog";
import { MediaFrame } from "../media-frame";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "../tooltip";
import { BillingToggle } from "./billing-toggle";
import { PricingCTA } from "./pricing-cta";
import { PRICE_CLASS, tierSurfaceClass } from "./surface";
import type { FeatureMatrixRow, PricingFullProps, PricingTier } from "./types";
import { resolveTierDisplay } from "./utils";

/**
 * Full pricing-page variant.
 *
 * Layout (sticky header approach):
 *   - Top header row: plan name + price + CTA per column.
 *   - Below: feature rows with label left + check/value per plan column.
 *   - Feature labels have an (i) tooltip; if videoSrc is set, a ▶ button opens a Dialog with MediaFrame.
 *   - Group headers span the full width.
 */
export function PricingFull({
	tiers,
	featureMatrix,
	featureGroupLabels = {},
	className,
	popularLabel,
	watchLabel,
	customPriceLabel,
	playLabel,
	pauseLabel,
	videoTitle,
	LinkComponent,
	monthlyLabel,
	yearlyLabel,
	yearlyBadge,
}: PricingFullProps) {
	const [isYearly, setIsYearly] = React.useState(false);
	const colCount = tiers.length;
	const hasYearly = tiers.some((t) => t.yearlyPrice);

	const groups = Array.from(
		new Set(featureMatrix.map((r) => r.group ?? "").filter(Boolean)),
	);
	const ungrouped = featureMatrix.filter((r) => !r.group);

	return (
		<TooltipProvider delayDuration={200}>
			<div className={cn("relative w-full", className)}>
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

				{/* Single table — thead aligns perfectly with tbody columns. The
				    scroll wrapper clips on every side, so `pt-2` leaves room for the
				    highlighted tier's ring. */}
				<div className="hidden overflow-x-auto pt-2 md:block">
					<table className="w-full min-w-140 border-collapse">
						<colgroup>
							<col style={{ width: "30%" }} />
							{tiers.map((t) => (
								<col key={t.id} style={{ width: `${70 / tiers.length}%` }} />
							))}
						</colgroup>

						{/* ── Plan header row ──────────────────────────────── */}
						<thead>
							<tr>
								{/* Empty label column */}
								<th className="pb-6 font-normal" />
								{tiers.map((tier) => (
									<th
										key={tier.id}
										className="px-2 pb-6 align-bottom font-normal"
									>
										<PlanHeader
											tier={tier}
											isYearly={isYearly}
											popularLabel={popularLabel}
											customPriceLabel={customPriceLabel}
											LinkComponent={LinkComponent}
										/>
									</th>
								))}
							</tr>
						</thead>

						{/* ── Feature rows ─────────────────────────────────── */}
						<tbody>
							{groups.map((group) => (
								<React.Fragment key={group}>
									<GroupRow
										label={featureGroupLabels[group] ?? group}
										colSpan={colCount + 1}
									/>
									{featureMatrix
										.filter((r) => r.group === group)
										.map((row) => (
											<FeatureRow
												key={row.id}
												row={row}
												tiers={tiers}
												watchLabel={watchLabel}
												playLabel={playLabel}
												pauseLabel={pauseLabel}
												videoTitle={videoTitle}
											/>
										))}
								</React.Fragment>
							))}
							{ungrouped.map((row) => (
								<FeatureRow
									key={row.id}
									row={row}
									tiers={tiers}
									watchLabel={watchLabel}
									playLabel={playLabel}
									pauseLabel={pauseLabel}
									videoTitle={videoTitle}
								/>
							))}
						</tbody>
					</table>
				</div>

				{/* Mobile: card-based layout (<768px) */}
				<div className="space-y-6 md:hidden">
					{tiers.map((tier) => (
						<MobilePlanCard
							key={tier.id}
							tier={tier}
							isYearly={isYearly}
							featureMatrix={featureMatrix}
							groups={groups}
							featureGroupLabels={featureGroupLabels}
							popularLabel={popularLabel}
							customPriceLabel={customPriceLabel}
							LinkComponent={LinkComponent}
						/>
					))}
				</div>
			</div>
		</TooltipProvider>
	);
}

// ─── Plan header cell ─────────────────────────────────────────────────────────

function PlanHeader({
	tier,
	isYearly,
	popularLabel,
	customPriceLabel,
	LinkComponent,
}: {
	tier: PricingTier;
	isYearly: boolean;
	popularLabel?: string;
	customPriceLabel?: string;
	LinkComponent?: PricingFullProps["LinkComponent"];
}) {
	const hl = tier.highlighted;
	const Icon = tier.icon;
	const {
		price: displayPrice,
		suffix: displaySuffix,
		isCustom: isCustomPrice,
	} = resolveTierDisplay(tier, isYearly, customPriceLabel);

	return (
		<div
			data-slot="pricing-tier"
			data-highlighted={hl ? "" : undefined}
			className={tierSurfaceClass(hl, "h-72.5 p-5 text-left")}
		>
			{/* Popular badge — fixed top slot so non-highlighted cards stay aligned */}
			<div className="mb-3 h-6">
				{hl && popularLabel && (
					<AreaBadge area="billing">{popularLabel}</AreaBadge>
				)}
			</div>

			<div className="mb-4 flex items-center gap-2.5">
				{Icon && (
					<AreaIcon area="billing" size="sm">
						<Icon />
					</AreaIcon>
				)}
				<h3 className="font-bold font-heading text-base tracking-heading">
					{tier.name}
				</h3>
			</div>

			<div className="mb-2">
				<div className="flex flex-wrap items-baseline gap-x-1.5">
					<span
						className={
							isCustomPrice
								? "font-extrabold font-heading text-2xl tracking-heading"
								: PRICE_CLASS
						}
					>
						{displayPrice}
					</span>
					{displaySuffix && !isCustomPrice && (
						<span className="text-muted-foreground text-sm">
							{displaySuffix}
						</span>
					)}
				</div>
				{tier.description && (
					<p className="mt-2 line-clamp-2 text-muted-foreground text-xs leading-5">
						{tier.description}
					</p>
				)}
			</div>

			<div className="mt-auto pt-4">
				<PricingCTA
					tier={tier}
					LinkComponent={LinkComponent}
					variant={hl ? "default" : "outline"}
					size="sm"
					isYearly={isYearly}
				/>
			</div>
		</div>
	);
}

// ─── Group header row ─────────────────────────────────────────────────────────

function GroupRow({ label, colSpan }: { label: string; colSpan: number }) {
	return (
		<tr>
			<td
				colSpan={colSpan}
				className="border-border border-t pt-8 pb-3 font-bold font-heading text-foreground text-sm"
			>
				{label}
			</td>
		</tr>
	);
}

// ─── Feature row ──────────────────────────────────────────────────────────────

function FeatureRow({
	row,
	tiers,
	watchLabel,
	playLabel,
	pauseLabel,
	videoTitle,
}: {
	row: FeatureMatrixRow;
	tiers: PricingTier[];
	watchLabel?: string;
	playLabel?: string;
	pauseLabel?: string;
	videoTitle?: string;
}) {
	const [videoOpen, setVideoOpen] = React.useState(false);

	return (
		<>
			<tr className="group transition-colors">
				{/* Feature label + tooltip + optional video trigger */}
				<td className="border-border/60 border-b py-4 pr-6 group-last:border-0">
					<div className="flex items-center gap-1.5">
						<span className="text-foreground text-sm">{row.label}</span>

						{(row.tooltip || row.videoSrc) && (
							<span className="ml-1 flex items-center gap-2">
								{row.tooltip && (
									<Tooltip>
										<TooltipTrigger asChild>
											<button
												type="button"
												className="rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
												aria-label={row.label}
											>
												<Info className="size-3.5" />
											</button>
										</TooltipTrigger>
										<TooltipContent
											side="top"
											align="start"
											className="max-w-64 text-xs leading-relaxed"
										>
											{row.tooltip}
										</TooltipContent>
									</Tooltip>
								)}
								{row.videoSrc && watchLabel && (
									<Button
										variant="ghost"
										size="sm"
										className="h-auto gap-1 px-2 py-0.5 font-semibold text-muted-foreground text-xs hover:text-foreground"
										onClick={() => setVideoOpen(true)}
									>
										<Play className="size-3 fill-current" />
										{watchLabel}
									</Button>
								)}
							</span>
						)}
					</div>
				</td>

				{/* Value per plan — the highlighted plan keeps a card-colored column band */}
				{tiers.map((tier) => {
					const val = row.values[tier.id];
					return (
						<td
							key={tier.id}
							className={cn(
								"border-border/60 border-b px-3 py-4 text-center text-sm group-last:border-0",
								tier.highlighted && "bg-card",
							)}
						>
							{val === true ? (
								<span className="inline-flex size-5 items-center justify-center rounded-full bg-area-billing text-area-billing-foreground">
									<Check aria-hidden="true" className="size-3" />
								</span>
							) : val === false || val === undefined ? (
								<Minus
									aria-hidden="true"
									className="mx-auto size-3.5 text-muted-foreground"
								/>
							) : (
								<span className="font-semibold text-foreground text-sm tabular-nums">
									{val}
								</span>
							)}
						</td>
					);
				})}
			</tr>

			{/* Video dialog — only rendered when videoSrc is set */}
			{row.videoSrc && (
				<Dialog open={videoOpen} onOpenChange={setVideoOpen}>
					<DialogContent className="max-w-3xl p-4">
						<DialogHeader>
							<DialogTitle>{row.label}</DialogTitle>
						</DialogHeader>
						<MediaFrame
							videoSrc={row.videoSrc}
							chrome
							filename={row.label}
							autoPlay
							className="w-full"
							playLabel={playLabel}
							pauseLabel={pauseLabel}
							videoTitle={videoTitle}
						/>
					</DialogContent>
				</Dialog>
			)}
		</>
	);
}

// ─── Mobile plan card ─────────────────────────────────────────────────────────

function MobilePlanCard({
	tier,
	isYearly,
	featureMatrix,
	groups,
	featureGroupLabels,
	popularLabel,
	customPriceLabel,
	LinkComponent,
}: {
	tier: PricingTier;
	isYearly: boolean;
	featureMatrix: FeatureMatrixRow[];
	groups: string[];
	featureGroupLabels: Record<string, string>;
	popularLabel?: string;
	customPriceLabel?: string;
	LinkComponent?: PricingFullProps["LinkComponent"];
}) {
	const hl = tier.highlighted;
	const Icon = tier.icon;
	const { price: displayPrice, suffix: displaySuffix } = resolveTierDisplay(
		tier,
		isYearly,
		customPriceLabel,
	);

	const includedRows = featureMatrix.filter((r) => {
		const val = r.values[tier.id];
		return val === true || typeof val === "string";
	});

	return (
		<div
			data-slot="pricing-tier"
			data-highlighted={hl ? "" : undefined}
			className={tierSurfaceClass(hl, "rounded-3xl p-6")}
		>
			<div className="mb-5 flex items-center justify-between gap-3">
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

			<div className="mb-1 flex flex-wrap items-baseline gap-x-2">
				<span className={PRICE_CLASS}>{displayPrice}</span>
				{displaySuffix && (
					<span className="text-muted-foreground text-sm">{displaySuffix}</span>
				)}
			</div>
			{tier.description && (
				<p className="mb-5 text-muted-foreground text-sm leading-6">
					{tier.description}
				</p>
			)}

			<div className="mb-6">
				<PricingCTA
					tier={tier}
					LinkComponent={LinkComponent}
					variant={hl ? "default" : "outline"}
					size="sm"
					isYearly={isYearly}
				/>
			</div>

			<div className="mb-4 h-px w-full bg-border" />

			<div className="space-y-5">
				{groups.map((group) => {
					const groupRows = includedRows.filter((r) => r.group === group);
					if (groupRows.length === 0) return null;
					return (
						<div key={group}>
							<p className="mb-2.5 font-bold font-heading text-sm">
								{featureGroupLabels[group] ?? group}
							</p>
							<IncludedList rows={groupRows} tierId={tier.id} />
						</div>
					);
				})}
				<IncludedList
					rows={includedRows.filter((r) => !r.group)}
					tierId={tier.id}
				/>
			</div>
		</div>
	);
}

function IncludedList({
	rows,
	tierId,
}: {
	rows: FeatureMatrixRow[];
	tierId: string;
}) {
	if (rows.length === 0) return null;
	return (
		<ul className="space-y-2.5">
			{rows.map((row) => {
				const val = row.values[tierId];
				return (
					<li key={row.id} className="flex items-start gap-2.5 text-sm">
						<Check
							aria-hidden="true"
							className="mt-0.5 size-4 shrink-0 text-area-billing-foreground"
						/>
						<span>
							{row.label}
							{typeof val === "string" && (
								<span className="text-muted-foreground">
									{" — "}
									{val}
								</span>
							)}
						</span>
					</li>
				);
			})}
		</ul>
	);
}
