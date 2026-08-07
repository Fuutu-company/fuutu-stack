"use client";

import { MediaFrame } from "@fuutu/ui";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { FeatureItem } from "./feature.config";

type FeatureHeroProps = {
	/** The single feature to showcase. Defaults to items[0] from FEATURES. */
	item: FeatureItem;
	/** Section heading (optional override) */
	heading?: string;
	/** Section sub-heading (optional override) */
	subheading?: string;
};

/**
 * FeatureHero — full-width section with title/description on the left
 * and a large MediaFrame Chrome mockup filling the center/right.
 *
 * Inspired by the reference image: gradient background behind the frame,
 * headline text above, key stat bullets optionally below.
 */
export function FeatureHero({ item, heading, subheading }: FeatureHeroProps) {
	const t = useTranslations("home.features.items");
	const tExpand = useTranslations("home.features");
	const frame = item.frames[0];
	const Icon = item.icon;
	const label = t(`${item.id}.label`);
	const title = t(`${item.id}.title`);
	const description = t(`${item.id}.description`);
	const frameLabel = t(`${item.id}.frameLabel`);

	return (
		<section className="relative py-20 md:py-28">
			{/* Ambient gradient backdrop */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 -z-10"
				style={{
					background:
						"radial-gradient(ellipse 80% 60% at 50% -10%, oklch(var(--primary)/0.18) 0%, transparent 70%)",
				}}
			/>

			<div className="container mx-auto max-w-6xl px-4">
				{/* Text block */}
				<motion.div
					initial={{ opacity: 0, y: 18 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.5 }}
					className="mx-auto mb-12 max-w-2xl text-center"
				>
					<div className="mb-4 inline-flex items-center gap-2 font-mono text-primary text-xs">
						<Icon className="size-3.5" strokeWidth={2} />
						{label}
					</div>

					<h2 className="mb-4 whitespace-pre-line font-bold text-4xl leading-tight tracking-tight md:text-5xl">
						{heading ?? title}
					</h2>

					<p className="text-lg text-muted-foreground leading-relaxed">
						{subheading ?? description}
					</p>
				</motion.div>

				{/* Frame — large, centered, bleeds slightly */}
				<motion.div
					initial={{ opacity: 0, y: 32, scale: 0.97 }}
					whileInView={{ opacity: 1, y: 0, scale: 1 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
					className="relative mx-auto max-w-4xl"
				>
					{/* Subtle glow under the frame */}
					<div
						aria-hidden
						className="pointer-events-none absolute inset-x-8 bottom-0 -z-10 h-32 blur-3xl"
						style={{
							background: "oklch(var(--primary)/0.2)",
						}}
					/>
					<MediaFrame
						chrome
						variant={frame.variant ?? "primary"}
						label={frameLabel}
						imageSrc={frame.imageSrc}
						imageAlt={frame.imageAlt}
						videoSrc={frame.videoSrc}
						iframeSrc={frame.iframeSrc}
						size="1280 × 720"
						sizePosition="bottom-left"
						width="100%"
						expandable
						expandLabel={tExpand("expand", { label })}
					/>
				</motion.div>
			</div>
		</section>
	);
}
