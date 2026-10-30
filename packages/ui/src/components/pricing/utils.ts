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

/** Format a major-unit amount with two decimals (e.g. 19.9 → "19.90"). */
export function formatAmount(value: number): string {
	return value.toFixed(2);
}

/**
 * Format a major-unit amount as currency via `Intl.NumberFormat` in the
 * host-provided `locale` (this package is framework-agnostic; hosts inject
 * their app locale so SSR and client render identically). Falls back to
 * `<symbol><fixed-decimals>` when `currency` isn't a valid ISO 4217 code.
 */
export function formatSeatPrice(
	amount: number,
	currency: string,
	fallbackSymbol: string,
	locale: string,
): string {
	try {
		return new Intl.NumberFormat(locale, {
			style: "currency",
			currency,
		}).format(amount);
	} catch {
		return `${fallbackSymbol}${formatAmount(amount)}`;
	}
}

/**
 * Sanitize a caller-supplied href for rendering into `<a href>` / link
 * components. Allows relative paths, anchors, http(s), mailto and tel;
 * everything else (javascript:, data:, protocol-relative, …) falls back
 * to "#" so a misconfigured tier can't inject an unsafe URL.
 */
export function safeHref(href: string): string {
	const value = href.trim();
	if (value.startsWith("//")) return "#";
	// Everything before the first /, ? or # that ends in ':' is a scheme.
	const scheme = /^[^/?#]*:/.exec(value);
	if (!scheme) return value;
	const name = scheme[0].slice(0, -1).toLowerCase();
	return name === "http" ||
		name === "https" ||
		name === "mailto" ||
		name === "tel"
		? value
		: "#";
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
