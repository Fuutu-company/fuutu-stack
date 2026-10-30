import { describe, expect, it, vi } from "vitest";
import { extractInvitationId, getSafeRedirect } from "../redirect";

vi.mock("@fuutu/env/public", () => ({
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

describe("extractInvitationId()", () => {
	it("returns the invitation id from an accept-invitation redirect", () => {
		expect(extractInvitationId("/auth/accept-invitation?id=inv_1")).toBe(
			"inv_1",
		);
	});

	it("ignores a trailing slash on the accept-invitation path", () => {
		expect(extractInvitationId("/auth/accept-invitation/?id=inv_1")).toBe(
			"inv_1",
		);
	});

	it("returns null for other paths", () => {
		expect(extractInvitationId("/dashboard?id=inv_1")).toBeNull();
		expect(extractInvitationId("/auth/accept-invitation")).toBeNull();
	});

	it("returns null for missing or unparseable targets", () => {
		expect(extractInvitationId(null)).toBeNull();
		expect(extractInvitationId(undefined)).toBeNull();
		expect(extractInvitationId("")).toBeNull();
	});

	it("returns null when a crafted external redirect is sanitized first", () => {
		// Regression: parsing the RAW redirect param forwarded an invitation
		// id from a URL the sanitizer rejected — an attacker could inject an
		// arbitrary invitation id into the sign-up payload.
		const sanitized = getSafeRedirect(
			"https://evil.example.com/auth/accept-invitation?id=forged",
		);
		expect(extractInvitationId(sanitized)).toBeNull();
	});

	it("accepts a same-origin absolute accept-invitation URL", () => {
		const sanitized = getSafeRedirect(
			"https://app.example.com/auth/accept-invitation?id=inv_2",
		);
		expect(extractInvitationId(sanitized)).toBe("inv_2");
	});
});
