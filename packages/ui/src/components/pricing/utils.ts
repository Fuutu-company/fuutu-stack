import type { PricingTier } from "./types";

export const SEAT_MIN = 1;
export const SEAT_MAX = 100;

/** Clamp a seat count into the allowed [SEAT_MIN, SEAT_MAX] range. */
export function clampSeatCount(value: number): number {
	return Math.min(SEAT_MAX, Math.max(SEAT_MIN, Math.trunc(value)));
}

/** Total price in whole currency units for a per-seat price given in cents. */
export function computeSeatTotal(
	pricePerSeatCents: number,
	seatCount: number,
): number {
	return (pricePerSeatCents * seatCount) / 100;
}

/** Pick the singular/plural seat label for a count. */
export function resolveSeatLabel(
	seatCount: number,
	labels: { seat: string; seats: string },
): string {
	return seatCount === 1 ? labels.seat : labels.seats;
}

/**
 * Resolve the displayed price + suffix for a tier.
 * `"—"` / `"-"` prices are custom (enterprise) tiers: the caller-supplied
 * `customLabel` wins, otherwise the raw placeholder is shown.
 */
export function resolveTierDisplay(
	tier: Pick<
		PricingTier,
		"price" | "priceSuffix" | "yearlyPrice" | "yearlyPriceSuffix"
	>,
	isYearly: boolean,
	customLabel?: string,
): { price: string; suffix?: string; isCustom: boolean } {
	const isCustom = tier.price === "—" || tier.price === "-";
	if (isCustom) {
		return { price: customLabel ?? tier.price, suffix: undefined, isCustom };
	}
	const price = isYearly && tier.yearlyPrice ? tier.yearlyPrice : tier.price;
	const suffix =
		isYearly && tier.yearlyPriceSuffix
			? tier.yearlyPriceSuffix
			: tier.priceSuffix;
	return { price, suffix, isCustom };
}
