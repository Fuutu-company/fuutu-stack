import { createElement, type ReactNode } from "react";
import { appMarketing } from "@/app-marketing";
import { PageIntro } from "../../shared/components/page-intro";
import {
	PricingCardsHome as KitPricingCardsHome,
	PricingCardsPage as KitPricingCardsPage,
} from "./components/pricing-cards";

/**
 * Kit pricing cards, or the app's (`appMarketing.PricingCards`). Resolved at
 * render time so an override that imports from `@marketing/pricing` never
 * sees `appMarketing` half-initialised in an import cycle.
 */
export function PricingCardsHome() {
	return createElement(appMarketing.PricingCards?.Home ?? KitPricingCardsHome);
}

export function PricingCardsPage() {
	return createElement(appMarketing.PricingCards?.Page ?? KitPricingCardsPage);
}

/**
 * `/pricing` header: the kit intro with the kit texts, the app's texts, or
 * the app's component (`appMarketing.pricingHeader`). Resolved at render
 * time, like the cards.
 */
export function PricingPageHeader({
	title,
	description,
}: {
	title: ReactNode;
	description: ReactNode;
}) {
	const header = appMarketing.pricingHeader;
	if (typeof header === "function") return createElement(header);
	return createElement(
		"div",
		{ className: "mx-auto max-w-6xl px-4 pt-12 sm:px-6 md:pt-20" },
		createElement(PageIntro, {
			align: "center",
			title: header?.title ?? title,
			description: header?.description ?? description,
		}),
	);
}
