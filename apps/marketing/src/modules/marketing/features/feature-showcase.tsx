"use client";

import { MediaFrame } from "@fuutu/ui";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { FeatureItem } from "./feature.config";

type FeatureShowcaseProps = {
	/** 2–6 feature items. First is selected by default. */
	items: FeatureItem[];
	/** Section heading */
	heading?: string;
	/** Section sub-heading */
	subheading?: string;
};

/** Per-card visual state derived from its distance to the active card. */
function getCardStyle(offset: number) {
	// offset 0 = active (front), 1 = one behind, 2 = two behind, etc.
	const clamp = Math.min(offset, 3);
	return {
		// Each card behind shifts left and slightly down
		x: clamp === 0 ? 0 : clamp * 52,
		y: clamp * 6,
		// Scale down cards behind
		scale: 1 - clamp * 0.045,
		// Dim cards behind
		opacity: clamp === 0 ? 1 : 1 - clamp * 0.28,
		// Active on top
		zIndex: 10 - clamp,
	};
}

const SPRING = {
	type: "spring",
	stiffness: 320,
	damping: 36,
	mass: 1,
} as const;

/**
 * FeatureShowcase — left column: clickable feature list.
 * Right column: stacked card deck — active item front/center,
 * others offset left + dimmed. Clicking triggers a spring-animated swap.
 */
export function FeatureShowcase({
	items,
	heading,
	subheading,
}: FeatureShowcaseProps) {
	const t = useTranslations("home.features.items");
	const tExpand = useTranslations("home.features");
	const [activeIdx, setActiveIdx] = useState(0);

	if (!items.length) return null;

	const handleSelect = (clickedIdx: number) => {
		setActiveIdx(clickedIdx);
	};

	return (
		<section className="py-20 md:py-28">
			<div className="container mx-auto max-w-6xl px-4">
				{/* Optional header */}
				{(heading ?? subheading) && (
					<motion.div
						initial={{ opacity: 0, y: 16 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.45 }}
						className="mb-14 max-w-2xl"
					>
						{heading && (
							<h2 className="mb-3 font-bold text-3xl tracking-tight md:text-4xl">
								{heading}
							</h2>
						)}
						{subheading && (
							<p className="text-lg text-muted-foreground">{subheading}</p>
						)}
					</motion.div>
				)}

				{/* ── Mobile: tab pills + single frame ── */}
				<div className="flex flex-col gap-6 lg:hidden">
					<div className="flex flex-wrap gap-1">
						{items.map((feature, idx) => {
							const isActive = idx === activeIdx;
							return (
								<button
									key={feature.id}
									type="button"
									onClick={() => handleSelect(idx)}
									className={[
										"rounded-full px-4 py-1.5 font-medium text-sm transition-all duration-200",
										isActive
											? "bg-foreground text-background"
											: "text-muted-foreground hover:text-foreground",
									].join(" ")}
								>
									{t(`${feature.id}.label`)}
								</button>
							);
						})}
					</div>
					{items[activeIdx] &&
						(() => {
							const feature = items[activeIdx];
							const chromeFrame =
								feature.frames.find((f) => !f.iphone) ?? feature.frames[0];
							return (
								<div className="flex flex-col gap-4">
									<motion.div
										key={feature.id}
										initial={{ opacity: 0, y: 8 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.25 }}
									>
										<MediaFrame
											chrome
											variant={chromeFrame.variant ?? "primary"}
											label={t(`${feature.id}.frameLabel`)}
											imageSrc={chromeFrame.imageSrc}
											imageAlt={chromeFrame.imageAlt}
											videoSrc={chromeFrame.videoSrc}
											iframeSrc={chromeFrame.iframeSrc}
											size="1280 × 720"
											sizePosition="bottom-left"
											width="100%"
											expandable
											expandLabel={tExpand("expand", {
												label: t(`${feature.id}.label`),
											})}
										/>
									</motion.div>
									<div>
										<p className="font-semibold text-base">
											{t(`${feature.id}.label`)}
										</p>
										<p className="mt-1 text-muted-foreground text-sm leading-relaxed">
											{t(`${feature.id}.description`)}
										</p>
									</div>
								</div>
							);
						})()}
				</div>

				{/* ── Desktop: left nav + stacked card deck ── */}
				<div className="hidden items-center gap-12 lg:grid lg:grid-cols-[1fr_2fr]">
					{/* Left — feature list */}
					<nav
						aria-label={tExpand("featureListAria")}
						className="flex flex-col"
					>
						{items.map((feature, idx) => {
							const isActive = idx === activeIdx;
							const isLast = idx === items.length - 1;

							return (
								<motion.button
									key={feature.id}
									type="button"
									initial={{ opacity: 0, x: -12 }}
									whileInView={{ opacity: 1, x: 0 }}
									viewport={{ once: true }}
									transition={{ duration: 0.4, delay: idx * 0.06 }}
									onClick={() => handleSelect(idx)}
									className={[
										"group relative flex w-full cursor-pointer items-start gap-0 py-5 pr-2 pl-5 text-left transition-colors duration-200",
										!isLast ? "border-border/50 border-b" : "",
									].join(" ")}
								>
									{/* Animated left accent */}
									<motion.span
										className="absolute top-0 bottom-0 left-0 w-[2px] rounded-full bg-primary"
										animate={{
											opacity: isActive ? 1 : 0,
											scaleY: isActive ? 1 : 0.4,
										}}
										transition={{ duration: 0.25, ease: "easeOut" }}
										style={{ transformOrigin: "top" }}
									/>

									{/* Text */}
									<div className="min-w-0 flex-1">
										<div
											className={[
												"mb-1.5 font-semibold text-base tracking-tight transition-colors duration-200",
												isActive
													? "text-foreground"
													: "text-muted-foreground group-hover:text-foreground",
											].join(" ")}
										>
											{t(`${feature.id}.label`)}
										</div>
										<motion.p
											animate={{
												opacity: isActive ? 1 : 0,
												height: isActive ? "auto" : 0,
											}}
											transition={{ duration: 0.2, ease: "easeOut" }}
											className="overflow-hidden text-muted-foreground text-sm leading-relaxed"
										>
											{t(`${feature.id}.description`)}
										</motion.p>
									</div>

									{/* Arrow */}
									<span
										className={[
											"mt-0.5 ml-3 shrink-0 transition-all duration-200",
											isActive
												? "translate-x-0 text-primary opacity-100"
												: "-translate-x-1 text-muted-foreground opacity-0 group-hover:translate-x-0 group-hover:opacity-40",
										].join(" ")}
										aria-hidden
									>
										<ArrowRight className="size-4" strokeWidth={1.75} />
									</span>
								</motion.button>
							);
						})}
					</nav>

					{/* Right — stacked card deck */}
					<div
						className="relative"
						style={{
							paddingBottom: `${Math.min(items.length - 1, 3) * 6}px`,
						}}
					>
						{/* Ambient glow behind the deck */}
						<div
							aria-hidden
							className="pointer-events-none absolute inset-x-12 bottom-8 -z-10 h-40 blur-3xl"
							style={{ background: "oklch(from var(--primary) l c h / 0.15)" }}
						/>

						{/* Render all cards, back-to-front so active is on top in DOM order too */}
						{[...items].reverse().map((feature, reversedIdx) => {
							const idx = items.length - 1 - reversedIdx;
							const offset = (idx - activeIdx + items.length) % items.length;
							const style = getCardStyle(offset);
							const chromeFrame =
								feature.frames.find((f) => !f.iphone) ?? feature.frames[0];
							const isActive = idx === activeIdx;

							return (
								<motion.div
									key={feature.id}
									animate={{
										x: style.x,
										y: style.y,
										scale: style.scale,
										opacity: style.opacity,
										zIndex: style.zIndex,
									}}
									transition={SPRING}
									style={{
										position: idx === 0 ? "relative" : "absolute",
										top: 0,
										left: 0,
										right: 0,
										transformOrigin: "top left",
									}}
									// Non-active cards are clickable to bring to front
									onClick={isActive ? undefined : () => handleSelect(idx)}
									className={isActive ? "" : "cursor-pointer"}
								>
									{/* Darkening overlay on non-active cards */}
									{!isActive && (
										<div
											aria-hidden
											className="pointer-events-none absolute inset-0 z-10 rounded-xl bg-background/40 backdrop-blur-[1px]"
										/>
									)}

									<MediaFrame
										chrome
										variant={chromeFrame.variant ?? "primary"}
										label={t(`${feature.id}.frameLabel`)}
										imageSrc={chromeFrame.imageSrc}
										imageAlt={chromeFrame.imageAlt}
										videoSrc={chromeFrame.videoSrc}
										iframeSrc={chromeFrame.iframeSrc}
										size="1280 × 720"
										sizePosition="bottom-left"
										width="100%"
										expandable={isActive}
										expandLabel={tExpand("expand", {
											label: t(`${feature.id}.label`),
										})}
									/>
								</motion.div>
							);
						})}
					</div>
				</div>
			</div>
		</section>
	);
}
