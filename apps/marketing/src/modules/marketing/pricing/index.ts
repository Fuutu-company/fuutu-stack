import { createElement } from "react";
import { appMarketing } from "@/app-marketing";
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
