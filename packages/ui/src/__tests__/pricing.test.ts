import { describe, expect, it } from "vitest";
import {
	clampSeatCount,
	computeSeatTotal,
	formatAmount,
	formatSeatPrice,
	resolveSeatLabel,
	resolveTierDisplay,
	safeHref,
} from "../components/pricing/utils";

describe("clampSeatCount", () => {
	it("clamps to the lower bound", () => {
		expect(clampSeatCount(0)).toBe(1);
		expect(clampSeatCount(-5)).toBe(1);
	});

	it("clamps to the upper bound", () => {
		expect(clampSeatCount(101)).toBe(100);
		expect(clampSeatCount(1000)).toBe(100);
	});

	it("keeps in-range values", () => {
		expect(clampSeatCount(1)).toBe(1);
		expect(clampSeatCount(50)).toBe(50);
		expect(clampSeatCount(100)).toBe(100);
	});
});

describe("computeSeatTotal", () => {
	it("converts per-seat cents to whole units", () => {
		expect(computeSeatTotal(1999, 1)).toBeCloseTo(19.99);
		expect(computeSeatTotal(1999, 3)).toBeCloseTo(59.97);
		expect(computeSeatTotal(0, 10)).toBe(0);
	});
});

describe("resolveSeatLabel", () => {
	const labels = { seat: "seat", seats: "seats" };

	it("uses the singular for one seat", () => {
		expect(resolveSeatLabel(1, labels)).toBe("seat");
	});

	it("uses the plural otherwise", () => {
		expect(resolveSeatLabel(0, labels)).toBe("seats");
		expect(resolveSeatLabel(2, labels)).toBe("seats");
	});
});

describe("resolveTierDisplay", () => {
	const tier = {
		price: "$12",
		priceSuffix: "/mo",
		yearlyPrice: "$10",
		yearlyPriceSuffix: "/mo billed yearly",
	};

	it("returns the monthly price by default", () => {
		expect(resolveTierDisplay(tier, false)).toEqual({
			price: "$12",
			suffix: "/mo",
			isCustom: false,
		});
	});

	it("returns the yearly price when yearly is selected", () => {
		expect(resolveTierDisplay(tier, true)).toEqual({
			price: "$10",
			suffix: "/mo billed yearly",
			isCustom: false,
		});
	});

	it("falls back to the monthly price when no yearly price exists", () => {
		const noYearly = { price: "$12", priceSuffix: "/mo" };
		expect(resolveTierDisplay(noYearly, true)).toEqual({
			price: "$12",
			suffix: "/mo",
			isCustom: false,
		});
	});

	it("marks placeholder prices as custom and prefers the custom label", () => {
		const custom = { price: "—" };
		expect(resolveTierDisplay(custom, false, "On request")).toEqual({
			price: "On request",
			suffix: undefined,
			isCustom: true,
		});
		expect(resolveTierDisplay({ price: "-" }, true)).toEqual({
			price: "-",
			suffix: undefined,
			isCustom: true,
		});
	});
});

describe("formatAmount", () => {
	it("formats major units with two decimals", () => {
		expect(formatAmount(19.9)).toBe("19.90");
		expect(formatAmount(20)).toBe("20.00");
		expect(formatAmount(59.97)).toBe("59.97");
		expect(formatAmount(0)).toBe("0.00");
	});
});

describe("safeHref", () => {
	it("allows http(s) URLs", () => {
		expect(safeHref("https://example.com/signup")).toBe(
			"https://example.com/signup",
		);
		expect(safeHref("http://localhost:3000/x")).toBe("http://localhost:3000/x");
	});

	it("allows relative and root-relative paths", () => {
		expect(safeHref("/pricing")).toBe("/pricing");
		expect(safeHref("signup")).toBe("signup");
		expect(safeHref("./plans")).toBe("./plans");
	});

	it("allows anchors, mailto and tel", () => {
		expect(safeHref("#compare")).toBe("#compare");
		expect(safeHref("mailto:sales@example.com")).toBe(
			"mailto:sales@example.com",
		);
		expect(safeHref("tel:+123456")).toBe("tel:+123456");
	});

	it("rejects non-http(s) schemes", () => {
		expect(safeHref("javascript:alert(1)")).toBe("#");
		expect(safeHref("data:text/html,<script>x</script>")).toBe("#");
		expect(safeHref("vbscript:msgbox(1)")).toBe("#");
	});

	it("rejects protocol-relative URLs and scheme smuggling", () => {
		expect(safeHref("//evil.com")).toBe("#");
		expect(safeHref("java\tscript:alert(1)")).toBe("#");
		expect(safeHref("  javascript:alert(1)  ")).toBe("#");
	});
});

describe("formatSeatPrice", () => {
	it("formats ISO currency codes via Intl", () => {
		expect(formatSeatPrice(59.97, "usd", "$")).toBe(
			new Intl.NumberFormat(undefined, {
				style: "currency",
				currency: "usd",
			}).format(59.97),
		);
	});

	it("falls back to symbol + fixed decimals for malformed codes", () => {
		expect(formatSeatPrice(59.97, "not-a-currency", "$")).toBe("$59.97");
	});
});
