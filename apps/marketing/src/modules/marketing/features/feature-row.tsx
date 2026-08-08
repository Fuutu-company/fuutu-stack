"use client";

import { MediaFrame } from "@fuutu/ui";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { FeatureItem } from "./feature.config";

type FeatureRowProps = {
	/**
	 * Exactly 3 feature items to display side by side.
	 * Slice FEATURES[1..4] or pass any 3 items from your config.
	 */
	items: [FeatureItem, FeatureItem, FeatureItem];
	/** Section heading */
	heading?: string;
	/** Section sub-heading */
	subheading?: string;
};

const CONTAINER = {
	hidden: {},
	show: { transition: { staggerChildren: 0.1 } },
};

const ITEM_VARIANT = {
	hidden: { opacity: 0, y: 20 },
	show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

/**
 * FeatureRow — 3 clickable MediaFrame chrome mockups in a horizontal row.
 * Clicking a frame expands it with the built-in expandable animation.
 * Below each frame: icon label, title, description.
 */
export function FeatureRow({ items, heading, subheading }: FeatureRowProps) {
	const t = useTranslations("home.features.items");
	const tExpand = useTranslations("home.features");
	return (
		<section className="py-20 md:py-28">
			<div className="container mx-auto max-w-6xl px-4">
				{/* Optional section header */}
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

				{/* 3-column grid */}
				<motion.div
					variants={CONTAINER}
					initial="hidden"
					whileInView="show"
					viewport={{ once: true }}
					className="grid grid-cols-1 gap-8 md:grid-cols-3"
				>
					{items.map((feature) => {
						const frame = feature.frames[0];
						const Icon = feature.icon;

						return (
							<motion.div
								key={feature.id}
								variants={ITEM_VARIANT}
								className="group flex flex-col gap-5"
							>
								{/* Frame wrapper — div, not button, because MediaFrame expandable renders its own button */}
								<div className="relative w-full cursor-pointer rounded-2xl ring-2 ring-transparent ring-offset-2 ring-offset-background transition-all duration-300 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-primary">
									{/* Glow on hover */}
									<div
										aria-hidden
										className="pointer-events-none absolute inset-0 -z-10 rounded-2xl opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
										style={{
											background: "oklch(var(--primary)/0.15)",
										}}
									/>
									<MediaFrame
										chrome
										variant={frame.variant ?? "primary"}
										label={t(`${feature.id}.frameLabel`)}
										imageSrc={frame.imageSrc}
										imageAlt={frame.imageAlt}
										videoSrc={frame.videoSrc}
										iframeSrc={frame.iframeSrc}
										size="1280 × 720"
										sizePosition="bottom-left"
										width="100%"
										expandable
										expandLabel={tExpand("expand", {
											label: t(`${feature.id}.label`),
										})}
									/>
								</div>

								{/* Text below */}
								<div className="flex flex-col gap-2">
									<div className="flex items-center gap-2 font-mono text-primary text-xs">
										<Icon className="size-3.5 shrink-0" strokeWidth={2} />
										{t(`${feature.id}.label`)}
									</div>
									<h3 className="whitespace-pre-line font-semibold text-xl leading-snug tracking-tight">
										{t(`${feature.id}.title`)}
									</h3>
									<p className="text-muted-foreground text-sm leading-relaxed">
										{t(`${feature.id}.description`)}
									</p>
								</div>
							</motion.div>
						);
					})}
				</motion.div>
			</div>
		</section>
	);
}
