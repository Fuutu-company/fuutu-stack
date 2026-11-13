import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SeatSelector } from "../components/pricing/seat-selector";
import { Slider } from "../components/slider";

const baseTranslations = {
	title: "Seats",
	seat: "seat",
	seats: "seats",
	perMonth: "/mo",
	perYear: "/yr",
	description: "Pick seats",
};

function renderSeats(extra: Record<string, string> = {}) {
	return renderToString(
		createElement(SeatSelector, {
			seatCount: 5,
			onChange: () => undefined,
			pricePerSeat: 1000,
			currency: "usd",
			currencySymbol: "$",
			locale: "en",
			translations: { ...baseTranslations, ...extra },
		}),
	);
}

describe("Slider thumbLabel", () => {
	it("sets the accessible name on the thumb", () => {
		const html = renderToString(
			createElement(Slider, {
				defaultValue: [60],
				max: 100,
				thumbLabel: "Storage limit",
			}),
		);
		expect(html).toMatch(/role="slider"[^>]*aria-label="Storage limit"/);
	});

	it("adds no aria-label when thumbLabel is omitted", () => {
		const html = renderToString(
			createElement(Slider, { defaultValue: [60], max: 100 }),
		);
		expect(html).toContain('role="slider"');
		expect(html).not.toContain("aria-label");
	});
});

describe("SeatSelector control labels", () => {
	it("names the decrement, increment and input controls", () => {
		const html = renderSeats({
			decrease: "Remove one seat",
			increase: "Add one seat",
			seatCount: "Number of seats",
		});
		expect(html).toContain('aria-label="Remove one seat"');
		expect(html).toContain('aria-label="Add one seat"');
		expect(html).toContain('aria-label="Number of seats"');
	});

	it("adds no aria-label when the labels are omitted", () => {
		expect(renderSeats()).not.toContain("aria-label");
	});
});
