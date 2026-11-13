"use client";

import { config } from "@fuutu/config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@fuutu/ui";
import { useTranslations } from "next-intl";
import { Screen, ScreenWindow } from "./screen-window";
import type { ScreenId } from "./screens";
import { SectionHeading } from "./section-heading";

type TourTab = "dashboard" | "assistant" | "team" | "dark";

const TOUR: { tab: TourTab; screen: ScreenId }[] = [
	{ tab: "dashboard", screen: "dashboardLight" },
	{ tab: "assistant", screen: "assistant" },
	{ tab: "team", screen: "team" },
	{ tab: "dark", screen: "dashboardDark" },
];

/** "See it before you sign up": accessible tabs (Radix) switching product screenshots. */
export function ProductTour() {
	const t = useTranslations("home.tour");
	const appName = config.app.name;

	return (
		<section id="tour" className="scroll-mt-28 px-4 pt-24 sm:px-6 md:pt-32">
			<div className="mx-auto max-w-6xl">
				<SectionHeading title={t("title")} />

				<Tabs defaultValue="dashboard" className="mt-10 md:mt-14">
					<div className="flex justify-center">
						<TabsList
							aria-label={t("tabsLabel")}
							className="h-auto max-w-full flex-wrap gap-1 rounded-[1.75rem] bg-card p-1.5 shadow-md sm:rounded-full"
						>
							{TOUR.map(({ tab }) => (
								<TabsTrigger
									key={tab}
									value={tab}
									className="rounded-full px-4 py-2.5 font-bold text-muted-foreground text-sm hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none sm:px-[1.125rem] sm:text-[0.90625rem]"
								>
									{t(`tabs.${tab}`)}
								</TabsTrigger>
							))}
						</TabsList>
					</div>

					{TOUR.map(({ tab, screen }) => (
						<TabsContent
							key={tab}
							value={tab}
							className="data-[state=active]:fade-in-0 mt-6 rounded-[1.75rem] focus-visible:ring-offset-4 data-[state=active]:animate-in motion-reduce:data-[state=active]:animate-none md:mt-7"
						>
							<ScreenWindow>
								{/* Eager: only the active panel is mounted, and the dashboard
								    shots share their file with the hero (already loaded). */}
								<Screen eager id={screen} alt={t(`alt.${tab}`, { appName })} />
							</ScreenWindow>
						</TabsContent>
					))}
				</Tabs>
			</div>
		</section>
	);
}
