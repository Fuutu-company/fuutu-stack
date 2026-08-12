"use client";

import { motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface FaqItem {
	q: string;
	a: string;
}

interface FaqCategory {
	key: string;
	label: string;
	description: string;
	items: FaqItem[];
}

export function FAQ() {
	const t = useTranslations("home.faq");
	const categories = t.raw("categories") as FaqCategory[];
	const [activeIdx, setActiveIdx] = useState(0);

	if (!categories.length) return null;

	const allItems = categories.flatMap((cat) => cat.items);
	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: allItems.map((item) => ({
			"@type": "Question",
			name: item.q,
			acceptedAnswer: {
				"@type": "Answer",
				text: item.a,
			},
		})),
	};

	return (
		<section className="py-24 md:py-32">
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
			/>
			<div className="container mx-auto px-4">
				<div className="mx-auto mb-12 max-w-2xl text-center">
					<p className="mb-3 font-semibold text-primary text-sm">
						{t("eyebrow")}
					</p>
					<h2 className="mb-4 font-bold text-3xl tracking-tight md:text-4xl">
						{t("title")}
					</h2>
					<p className="text-lg text-muted-foreground">{t("description")}</p>
				</div>

				<div className="mx-auto max-w-5xl">
					<div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_2fr] lg:gap-12">
						<nav aria-label={t("categoryAria")} className="flex flex-col">
							{categories.map((cat, idx) => {
								const isActive = idx === activeIdx;
								const isLast = idx === categories.length - 1;

								return (
									<motion.button
										key={cat.key}
										type="button"
										initial={{ opacity: 0, x: -12 }}
										whileInView={{ opacity: 1, x: 0 }}
										viewport={{ once: true }}
										transition={{ duration: 0.4, delay: idx * 0.06 }}
										onClick={() => setActiveIdx(idx)}
										className={[
											"group relative flex w-full cursor-pointer items-start gap-0 py-5 pr-2 pl-5 text-left transition-colors duration-200",
											!isLast ? "border-border/50 border-b" : "",
										].join(" ")}
									>
										<motion.span
											className="absolute top-0 bottom-0 left-0 w-[2px] rounded-full bg-primary"
											animate={{
												opacity: isActive ? 1 : 0,
												scaleY: isActive ? 1 : 0.4,
											}}
											transition={{ duration: 0.25, ease: "easeOut" }}
											style={{ transformOrigin: "top" }}
										/>

										<div className="min-w-0 flex-1">
											<div
												className={[
													"mb-1.5 font-semibold text-base tracking-tight transition-colors duration-200",
													isActive
														? "text-foreground"
														: "text-muted-foreground group-hover:text-foreground",
												].join(" ")}
											>
												{cat.label}
											</div>
											<motion.p
												animate={{
													opacity: isActive ? 1 : 0,
													height: isActive ? "auto" : 0,
												}}
												transition={{ duration: 0.2, ease: "easeOut" }}
												className="overflow-hidden text-muted-foreground text-sm leading-relaxed"
											>
												{cat.description}
											</motion.p>
										</div>

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

						<div className="relative">
							{categories.map((cat, idx) => {
								const isActive = idx === activeIdx;
								return (
									<div key={cat.key} className={isActive ? "block" : "hidden"}>
										<div className="divide-y border-y">
											{cat.items.map((item, itemIdx) => (
												<details
													key={`${cat.key}-${itemIdx}`}
													className="group [&[open]>summary>svg]:rotate-180"
												>
													<summary className="flex cursor-pointer list-none items-center justify-between py-5 font-semibold text-base">
														<span>{item.q}</span>
														<ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform" />
													</summary>
													<p className="mt-3 pb-5 text-muted-foreground text-sm leading-relaxed">
														{item.a}
													</p>
												</details>
											))}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
