import { describe, expect, it } from "vitest";
import { matchesPublicPath } from "../public-path";

describe("matchesPublicPath", () => {
	it("string entries match by prefix", () => {
		expect(matchesPublicPath("/api/webhooks/creem", ["/api/webhooks"])).toBe(
			true,
		);
		expect(matchesPublicPath("/api/webhooks", ["/api/webhooks"])).toBe(true);
		expect(matchesPublicPath("/api/other", ["/api/webhooks"])).toBe(false);
	});

	it("{ exact } entries match only the identical path", () => {
		const entries = [{ exact: "/pricing" }] as const;
		expect(matchesPublicPath("/pricing", entries)).toBe(true);
		expect(matchesPublicPath("/pricing/enterprise", entries)).toBe(false);
		expect(matchesPublicPath("/pricing-old", entries)).toBe(false);
		expect(matchesPublicPath("/", entries)).toBe(false);
	});

	it("mixes both entry kinds", () => {
		const entries = ["/api/hooks", { exact: "/status" }] as const;
		expect(matchesPublicPath("/api/hooks/x", entries)).toBe(true);
		expect(matchesPublicPath("/status", entries)).toBe(true);
		expect(matchesPublicPath("/status/details", entries)).toBe(false);
	});

	it("matches nothing for an empty list", () => {
		expect(matchesPublicPath("/anything", [])).toBe(false);
	});
});
