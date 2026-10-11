"use client";

import { Button, type LogoItem, LogoRail, MediaFrame } from "@fuutu/ui";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { urls } from "@/lib/urls";

const STACK_LOGOS = [
	{ id: "nextjs", logo: "/logo/nextjs.svg", logoAlt: "Next.js" },
	{ id: "typescript", logo: "/logo/typescript.svg", logoAlt: "TypeScript" },
	{
		id: "better-auth",
		logo: "/logo/better-auth.svg",
		logoAlt: "Better Auth",
	},
	{
		id: "prisma",
		logo: "/logo/prisma.svg",
		logoAlt: "Prisma",
		invertInDark: true,
	},
	{ id: "postgresql", logo: "/logo/postgresql.svg", logoAlt: "PostgreSQL" },
	{
		id: "tailwind",
		logo: "/logo/tailwindcss.svg",
		logoAlt: "Tailwind CSS",
	},
	{ id: "turborepo", logo: "/logo/turborepo.svg", logoAlt: "Turborepo" },
	{ id: "hono", logo: "/logo/hono.svg", logoAlt: "Hono" },
] as const;

export function Hero() {
	const t = useTranslations("home.hero");
	const stackLogos: LogoItem[] = STACK_LOGOS.map((item) => ({
		...item,
		name: t(`stack.${item.id}.name`),
		description: t(`stack.${item.id}.description`),
		detail: t(`stack.${item.id}.detail`),
	}));
	return (
		<section className="flex min-h-[calc(100svh-4.5rem)] items-center overflow-x-hidden px-4 py-14 sm:px-6 sm:py-16 lg:py-20">
			<div className="mx-auto grid w-full max-w-screen-2xl items-center gap-12 lg:grid-cols-2 lg:gap-16 xl:gap-20">
				{/* ── Left — Text content ── */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.55 }}
					className="flex flex-col items-start"
				>
					{/* Headline */}
					<h1 className="mb-5 font-bold text-5xl text-foreground tracking-tight sm:mb-6 sm:text-6xl md:text-7xl lg:text-7xl xl:text-8xl">
						{t("title")}{" "}
						<span className="text-primary">{t("titleHighlight")}</span>
					</h1>

					{/* Description */}
					<p className="mb-8 max-w-lg text-balance text-base text-foreground/65 sm:mb-10 sm:max-w-xl sm:text-lg lg:text-xl">
						{t("description")}
					</p>

					{/* CTAs */}
					<div className="mb-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4">
						<Button
							size="lg"
							className="h-12 w-full justify-center rounded-full px-8 text-sm sm:h-13 sm:w-auto sm:px-10 sm:text-base"
							asChild
						>
							<a href={urls.auth.signUp}>
								{t("cta.getStarted")}
								<ArrowRight className="ml-2 size-5" />
							</a>
						</Button>
						<Button
							size="lg"
							variant="outline"
							className="h-12 w-full justify-center rounded-full px-8 text-sm sm:h-13 sm:w-auto sm:px-10 sm:text-base"
							asChild
						>
							<a href={urls.docs} target="_blank" rel="noopener noreferrer">
								{t("cta.viewDocs")}
							</a>
						</Button>
					</div>

					{/* Stack logo rail */}
					<LogoRail items={stackLogos} />
				</motion.div>

				{/* ── Right — Layered mockup (Chrome + iPhone overlay) ── */}
				<motion.div
					initial={{ opacity: 0, y: 24 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, delay: 0.15 }}
					className="relative w-full"
				>
					{/* Chrome frame */}
					<MediaFrame
						chrome
						variant="primary"
						label={t("glassCard.ready")}
						size="1280 × 720"
						sizePosition="bottom-left"
						width="100%"
					/>
					{/* iPhone — positioned bottom-right, width is a % of the parent so it always scales correctly */}
					<div
						className="absolute right-0 bottom-[-30%] drop-shadow-2xl"
						style={{ width: "clamp(80px, 28%, 220px)" }}
					>
						<MediaFrame
							iphone
							variant="primary"
							label={t("glassCard.ready")}
							size="390 × 844"
							width="100%"
						/>
					</div>
				</motion.div>
			</div>
		</section>
	);
}
