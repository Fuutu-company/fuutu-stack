"use client";

import { Badge } from "@fuutu/ui";
import { CONTRAST_PAIRS, type ContrastPair } from "@fuutu/ui/color";
import { cn } from "@fuutu/utils/cn";
import { Check, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRef } from "react";
import {
	CONTRAST_GROUPS,
	contrastGroupOf,
	contrastPairKey,
} from "../../tokens";
import { useMeasuredContrast } from "../../use-measured-contrast";
import { richCode } from "../design-section";
import { DesignSubsection } from "../design-subsection";

/** The destructive pair is measured on what buttons render: literal white on the fill. */
const DESTRUCTIVE_SURFACE = "bg-destructive dark:bg-destructive/60";
/** The hover pair is measured on what `hover:bg-primary/90` renders. */
const PRIMARY_HOVER_SURFACE = "bg-primary/90 text-primary-foreground";
/** The marketing SecurityBand tile (`bg-primary-foreground/[0.08]` over `bg-primary`) flattened to one opaque fill. */
const PRIMARY_BAND_SURFACE =
	"bg-[color-mix(in_srgb,var(--primary-foreground)_8%,var(--primary))] text-primary-foreground";
/** The focus-ring pair is measured on what `ring-ring/50` renders over the page. */
const FOCUS_RING_SAMPLE = "color-mix(in oklch, var(--ring) 50%, transparent)";

type SampleKind = "text" | "outline" | "fill";

function sampleKindOf(pair: ContrastPair): SampleKind {
	if (pair.min >= 4.5) return "text";
	return pair.fg.startsWith("chart-") ? "fill" : "outline";
}

function PairTile({ pair }: { pair: ContrastPair }) {
	const t = useTranslations("designSystem.foundations.colors");
	const format = useFormatter();
	const surfaceRef = useRef<HTMLDivElement>(null);
	const fgRef = useRef<HTMLSpanElement>(null);
	const ratio = useMeasuredContrast(surfaceRef, fgRef);

	const measured = ratio !== null;
	const pass = measured && ratio >= pair.min;
	const isDestructiveFill = pair.effective === "destructive-fill";
	const isPrimaryHover = pair.effective === "primary-hover-blend";
	const isFocusRing = pair.effective === "focus-ring";
	const isPrimaryBand = pair.effective === "primary-band-tile";
	const isEffective = isDestructiveFill || isPrimaryHover || isPrimaryBand;
	const kind = sampleKindOf(pair);

	return (
		<li className="flex items-start gap-3 rounded-xl border bg-card p-3 text-card-foreground shadow-xs">
			<div
				ref={surfaceRef}
				className={cn(
					"flex size-14 shrink-0 items-center justify-center rounded-lg border",
					isDestructiveFill && DESTRUCTIVE_SURFACE,
					isPrimaryHover && PRIMARY_HOVER_SURFACE,
					isPrimaryBand && PRIMARY_BAND_SURFACE,
				)}
				style={
					isEffective ? undefined : { backgroundColor: `var(--${pair.bg})` }
				}
			>
				<span
					ref={fgRef}
					aria-hidden="true"
					className={cn(
						"leading-none",
						kind === "text" && "font-bold text-xl",
						kind === "outline" &&
							"size-7 rounded-md border-[3px] border-current",
						kind === "fill" && "size-7 rounded-full bg-current",
						isDestructiveFill && "text-white",
					)}
					style={
						isEffective
							? undefined
							: {
									color: isFocusRing ? FOCUS_RING_SAMPLE : `var(--${pair.fg})`,
								}
					}
				>
					{kind === "text" ? t("sample") : null}
				</span>
			</div>
			<div className="min-w-0 flex-1 space-y-2">
				<p className="text-sm leading-5">
					{t.rich("pair", {
						fg: pair.fg,
						bg: pair.bg,
						...richCode,
					})}
				</p>
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
					<Badge
						variant="outline"
						data-testid="contrast-badge"
						data-pass={measured ? String(pass) : "pending"}
						data-pair={contrastPairKey(pair)}
						className={cn(
							"tabular-nums",
							measured && (pass ? "text-success" : "text-destructive"),
						)}
					>
						{measured ? (
							pass ? (
								<Check aria-hidden="true" />
							) : (
								<X aria-hidden="true" />
							)
						) : null}
						{measured
							? t("badge", {
									ratio: format.number(ratio, {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2,
									}),
									status: pass ? "pass" : "fail",
								})
							: t("pending")}
					</Badge>
					<span className="text-muted-foreground text-xs">
						{t("minimum", { ratio: format.number(pair.min) })}
					</span>
				</div>
			</div>
		</li>
	);
}

export function ColorRoles() {
	const t = useTranslations("designSystem.foundations.colors");

	return (
		<DesignSubsection
			title={t("title")}
			description={t.rich("description", richCode)}
		>
			<div className="space-y-8">
				{CONTRAST_GROUPS.map((group) => {
					const pairs = CONTRAST_PAIRS.filter(
						(pair) => contrastGroupOf(pair) === group,
					);
					return (
						<div key={group} className="space-y-3">
							<div className="space-y-0.5">
								<h4 className="font-medium text-sm">
									{t(`groups.${group}.title`)}
								</h4>
								<p className="text-muted-foreground text-xs leading-4">
									{t(`groups.${group}.description`)}
								</p>
							</div>
							<ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
								{pairs.map((pair) => (
									<PairTile key={contrastPairKey(pair)} pair={pair} />
								))}
							</ul>
						</div>
					);
				})}
			</div>
		</DesignSubsection>
	);
}
