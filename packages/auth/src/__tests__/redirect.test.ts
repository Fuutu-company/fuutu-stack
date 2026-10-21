import { describe, expect, it, vi } from "vitest";
import { getSafeRedirect } from "../redirect";

vi.mock("@fuutu/env/saas", () => ({
	env: {
		NEXT_PUBLIC_SAAS_URL: "https://app.example.com",
	},
}));

describe("getSafeRedirect()", () => {
	it("returns the afterSignIn fallback for missing targets", () => {
		expect(getSafeRedirect(null)).toBe("/dashboard");
		expect(getSafeRedirect(undefined)).toBe("/dashboard");
		expect(getSafeRedirect("")).toBe("/dashboard");
	});

	it("returns the fallback for external origins", () => {
		expect(getSafeRedirect("https://evil.example.com/phish")).toBe(
			"/dashboard",
		);
	});

	it("returns the fallback for protocol-relative URLs", () => {
		expect(getSafeRedirect("//evil.example.com")).toBe("/dashboard");
	});

	it("accepts relative paths", () => {
		expect(getSafeRedirect("/settings/billing")).toBe("/settings/billing");
	});

	it("accepts same-origin absolute URLs under NEXT_PUBLIC_SAAS_URL", () => {
		expect(getSafeRedirect("https://app.example.com/settings")).toBe(
			"https://app.example.com/settings",
		);
	});
});
