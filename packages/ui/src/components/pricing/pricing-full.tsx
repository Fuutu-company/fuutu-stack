"use client";

import { Check, Info, Minus, Play } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils";
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
import type { FeatureMatrixRow, PricingFullProps, PricingTier } from "./types";

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
	watchLabel = "Watch demo",
	customPriceLabel = "On request",
	LinkComponent,
	monthlyLabel = "Monthly",
	yearlyLabel = "Yearly",
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
				{/* Ambient gradient */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 -z-10"
					style={{
						background:
							"radial-gradient(ellipse 70% 40% at 50% -5%, oklch(var(--primary)/0.1) 0%, transparent 60%)",
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

				{/* Single table — thead aligns perfectly with tbody columns */}
				<div className="hidden overflow-x-auto md:block">
					<table className="w-full min-w-[560px] border-collapse">
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
	customPriceLabel: string;
	LinkComponent?: PricingFullProps["LinkComponent"];
}) {
	const hl = tier.highlighted;
	const Icon = tier.icon;
	const isCustomPrice = tier.price === "—" || tier.price === "-";
	const displayPrice = isCustomPrice
		? customPriceLabel
		: isYearly && tier.yearlyPrice
			? tier.yearlyPrice
			: tier.price;
	const displaySuffix = isCustomPrice
		? undefined
		: isYearly && tier.yearlyPriceSuffix
			? tier.yearlyPriceSuffix
			: tier.priceSuffix;
	const isEnterprise = isCustomPrice;

	return (
		<div
			className={cn(
				"relative flex h-[290px] flex-col rounded-2xl p-5",
				hl
					? "bg-primary text-primary-foreground shadow-2xl ring-2 ring-primary/30"
					: isEnterprise
						? "border border-primary/30 bg-card/80 shadow-lg ring-1 ring-primary/20 backdrop-blur-sm"
						: "border bg-card/80 shadow-sm backdrop-blur-sm",
			)}
		>
			{/* Glow */}
			{(hl || isEnterprise) && (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-6 -bottom-4 -z-10 h-12 blur-2xl"
					style={{
						background: hl
							? "oklch(var(--primary)/0.45)"
							: "oklch(var(--primary)/0.2)",
					}}
				/>
			)}

			{/* Popular badge — fixed top slot so non-highlighted cards stay aligned */}
			<div className="mb-3 h-5">
				{hl && popularLabel && (
					<span className="inline-flex items-center gap-1 rounded-full bg-primary-foreground px-2.5 py-0.5 font-semibold text-[11px] text-primary uppercase tracking-wide">
						{popularLabel}
					</span>
				)}
			</div>

			{/* Plan identity */}
			<div className="mb-4 flex items-center gap-2">
				{Icon && (
					<span
						className={cn(
							"flex size-7 shrink-0 items-center justify-center rounded-lg",
							hl ? "bg-primary-foreground/15" : "bg-primary/10",
						)}
					>
						<Icon
							className={cn(
								"size-4",
								hl ? "text-primary-foreground" : "text-primary",
							)}
						/>
					</span>
				)}
				<span
					className={cn(
						"font-semibold text-base",
						hl ? "text-primary-foreground" : "text-foreground",
					)}
				>
					{tier.name}
				</span>
			</div>

			{/* Price block */}
			<div className="mb-2">
				<div className="flex items-baseline gap-1.5">
					<span
						className={cn(
							isCustomPrice
								? "font-bold text-2xl tracking-tight"
								: "font-extrabold text-4xl tracking-tighter",
							hl ? "text-primary-foreground" : "text-foreground",
						)}
					>
						{displayPrice}
					</span>
					{displaySuffix && !isCustomPrice && (
						<span
							className={cn(
								"text-sm",
								hl ? "text-primary-foreground/60" : "text-muted-foreground",
							)}
						>
							{displaySuffix}
						</span>
					)}
				</div>
				{tier.description && (
					<p
						className={cn(
							"mt-2 line-clamp-2 text-xs leading-relaxed",
							hl ? "text-primary-foreground/65" : "text-muted-foreground",
						)}
					>
						{tier.description}
					</p>
				)}
			</div>

			{/* Divider + CTA — pushed to bottom via mt-auto */}
			<div className="mt-auto">
				<div
					className={cn(
						"mb-4 h-px w-full",
						hl ? "bg-primary-foreground/15" : "bg-border",
					)}
				/>
				<PricingCTA
					tier={tier}
					LinkComponent={LinkComponent}
					inverted={hl}
					size="sm"
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
				className="border-border border-t pt-8 pb-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-widest"
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
}: {
	row: FeatureMatrixRow;
	tiers: PricingTier[];
	watchLabel: string;
}) {
	const [videoOpen, setVideoOpen] = React.useState(false);

	return (
		<>
			<tr className="group transition-colors">
				{/* Feature label + tooltip + optional video trigger */}
				<td className="border-border/40 border-b py-4 pr-6 group-last:border-0">
					<div className="flex items-center gap-1.5">
						<span className="text-foreground/90 text-sm">{row.label}</span>

						{(row.tooltip || row.videoSrc) && (
							<span className="ml-1 flex items-center gap-2">
								{row.tooltip && (
									<Tooltip>
										<TooltipTrigger asChild>
											<button
												type="button"
												className="text-muted-foreground/70 transition-colors hover:text-primary"
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
								{row.videoSrc && (
									<Button
										variant="ghost"
										size="sm"
										className="h-auto gap-1 px-2 py-0.5 font-medium text-primary/60 text-xs hover:text-primary"
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

				{/* Value per plan — alternating column bands make row→plan mapping obvious */}
				{tiers.map((tier, i) => {
					const val = row.values[tier.id];
					return (
						<td
							key={tier.id}
							className={cn(
								"border-border/40 border-b px-3 py-4 text-center text-sm group-last:border-0",
								tier.highlighted
									? "bg-primary/12"
									: tier.price === "—" || tier.price === "-"
										? "bg-primary/6"
										: i % 2 === 0
											? "bg-muted/30"
											: "bg-muted/10",
							)}
						>
							{val === true ? (
								<span
									className={cn(
										"inline-flex size-5 items-center justify-center rounded-full",
										tier.highlighted
											? "bg-primary-foreground text-primary"
											: "bg-primary/15 text-primary",
									)}
								>
									<Check className="size-3" />
								</span>
							) : val === false || val === undefined ? (
								<Minus className="mx-auto size-3.5 text-muted-foreground/20" />
							) : (
								<span className="font-semibold text-foreground text-sm">
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
	customPriceLabel: string;
	LinkComponent?: PricingFullProps["LinkComponent"];
}) {
	const hl = tier.highlighted;
	const Icon = tier.icon;
	const isCustomPrice = tier.price === "—" || tier.price === "-";
	const displayPrice = isCustomPrice
		? customPriceLabel
		: isYearly && tier.yearlyPrice
			? tier.yearlyPrice
			: tier.price;
	const displaySuffix = isCustomPrice
		? undefined
		: isYearly && tier.yearlyPriceSuffix
			? tier.yearlyPriceSuffix
			: tier.priceSuffix;

	const includedRows = featureMatrix.filter((r) => {
		const val = r.values[tier.id];
		return val === true || typeof val === "string";
	});

	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-3xl p-6",
				hl
					? "bg-primary text-primary-foreground shadow-2xl"
					: "border border-border/60 bg-card shadow-sm",
			)}
		>
			{hl && (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 top-0 h-px"
					style={{
						background:
							"linear-gradient(90deg, transparent, oklch(var(--primary-foreground)/0.4), transparent)",
					}}
				/>
			)}

			<div className="mb-5 flex items-center justify-between">
				<div className="flex items-center gap-2.5">
					{Icon && (
						<span
							className={cn(
								"flex size-8 shrink-0 items-center justify-center rounded-xl",
								hl ? "bg-primary-foreground/15" : "bg-primary/10",
							)}
						>
							<Icon
								className={cn(
									"size-4",
									hl ? "text-primary-foreground" : "text-primary",
								)}
							/>
						</span>
					)}
					<span
						className={cn(
							"font-semibold text-lg tracking-tight",
							hl ? "text-primary-foreground" : "text-foreground",
						)}
					>
						{tier.name}
					</span>
				</div>
				{hl && popularLabel && (
					<span className="rounded-full bg-primary-foreground px-3 py-0.5 font-semibold text-[11px] text-primary uppercase tracking-wide">
						{popularLabel}
					</span>
				)}
			</div>

			<div className="mb-1">
				<span
					className={cn(
						"font-bold text-4xl tracking-tighter",
						hl ? "text-primary-foreground" : "text-foreground",
					)}
				>
					{displayPrice}
				</span>
				{displaySuffix && (
					<span
						className={cn(
							"ml-2 text-sm",
							hl ? "text-primary-foreground/60" : "text-muted-foreground",
						)}
					>
						{displaySuffix}
					</span>
				)}
			</div>
			{tier.description && (
				<p
					className={cn(
						"mb-5 text-sm leading-relaxed",
						hl ? "text-primary-foreground/65" : "text-muted-foreground",
					)}
				>
					{tier.description}
				</p>
			)}

			<div className="mb-6">
				<PricingCTA
					tier={tier}
					LinkComponent={LinkComponent}
					inverted={hl}
					size="sm"
				/>
			</div>

			<div
				className={cn(
					"mb-4 h-px w-full",
					hl ? "bg-primary-foreground/15" : "bg-border",
				)}
			/>

			<div className="space-y-5">
				{groups.map((group) => {
					const groupRows = includedRows.filter((r) => r.group === group);
					if (groupRows.length === 0) return null;
					return (
						<div key={group}>
							<p
								className={cn(
									"mb-2.5 font-semibold text-[11px] uppercase tracking-widest",
									hl
										? "text-primary-foreground/40"
										: "text-muted-foreground/70",
								)}
							>
								{featureGroupLabels[group] ?? group}
							</p>
							<ul className="space-y-2.5">
								{groupRows.map((row) => {
									const val = row.values[tier.id];
									return (
										<li
											key={row.id}
											className="flex items-start gap-2.5 text-sm"
										>
											<Check
												className={cn(
													"mt-0.5 size-4 shrink-0",
													hl ? "text-primary-foreground" : "text-primary",
												)}
											/>
											<span
												className={cn(
													hl
														? "text-primary-foreground/90"
														: "text-foreground/90",
												)}
											>
												{row.label}
												{typeof val === "string" && (
													<span
														className={cn(
															hl
																? "text-primary-foreground/60"
																: "text-muted-foreground",
														)}
													>
														{" — "}
														{val}
													</span>
												)}
											</span>
										</li>
									);
								})}
							</ul>
						</div>
					);
				})}
				{(() => {
					const ungrouped = includedRows.filter((r) => !r.group);
					if (ungrouped.length === 0) return null;
					return (
						<ul className="space-y-2.5">
							{ungrouped.map((row) => {
								const val = row.values[tier.id];
								return (
									<li key={row.id} className="flex items-start gap-2.5 text-sm">
										<Check
											className={cn(
												"mt-0.5 size-4 shrink-0",
												hl ? "text-primary-foreground" : "text-primary",
											)}
										/>
										<span
											className={cn(
												hl
													? "text-primary-foreground/90"
													: "text-foreground/90",
											)}
										>
											{row.label}
											{typeof val === "string" && (
												<span
													className={cn(
														hl
															? "text-primary-foreground/60"
															: "text-muted-foreground",
													)}
												>
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
				})()}
			</div>
		</div>
	);
}
