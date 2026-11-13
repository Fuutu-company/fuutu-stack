import { describe, expect, it, vi } from "vitest";
import {
	extractInvitationId,
	getEmailVerificationRedirect,
	getSafeRedirect,
	getSignedInRedirect,
} from "../redirect";

// Distinct from afterSignIn ("/dashboard") so a wrong fallback is caught.
vi.mock("../config", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../config")>();
	return {
		authConfig: {
			...actual.authConfig,
			redirects: {
				...actual.authConfig.redirects,
				afterEmailVerification: "/verified",
			},
		},
	};
});

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

describe("getEmailVerificationRedirect()", () => {
	it("falls back to afterEmailVerification when no target is given", () => {
		expect(getEmailVerificationRedirect(null)).toBe("/verified");
		expect(getEmailVerificationRedirect(undefined)).toBe("/verified");
	});

	it("keeps an explicit same-origin target (e.g. an invitation link)", () => {
		expect(
			getEmailVerificationRedirect("/auth/accept-invitation?id=inv_1"),
		).toBe("/auth/accept-invitation?id=inv_1");
	});

	it("rejects external targets", () => {
		expect(getEmailVerificationRedirect("https://evil.example.com")).toBe(
			"/verified",
		);
	});
});

describe("getSignedInRedirect()", () => {
	it("sends a signed-in visitor to a safe redirect target", () => {
		expect(getSignedInRedirect({ redirect: "/settings/billing" })).toBe(
			"/settings/billing",
		);
		expect(
			getSignedInRedirect({ redirect: "https://app.example.com/settings" }),
		).toBe("https://app.example.com/settings");
	});

	it("falls back to afterSignIn without a usable redirect param", () => {
		expect(getSignedInRedirect({})).toBe("/dashboard");
		expect(getSignedInRedirect({ redirect: "" })).toBe("/dashboard");
		expect(getSignedInRedirect({ redirect: ["/a", "/b"] })).toBe("/dashboard");
	});

	it("rejects open-redirect attempts", () => {
		for (const redirect of [
			"https://evil.example.com/phish",
			"//evil.example.com",
			"/\\evil.example.com",
			"javascript:alert(1)",
		]) {
			expect(getSignedInRedirect({ redirect }), redirect).toBe("/dashboard");
		}
	});

	it("never targets the sign-in or sign-up page (redirect loop)", () => {
		for (const redirect of [
			"/auth/sign-in",
			"/auth/sign-up/",
			"/auth/sign-in?redirect=%2Fauth%2Fsign-up",
			"https://app.example.com/auth/sign-up",
			"/auth/sign-in//",
			"/auth//sign-in",
			"/auth/%73ign-in",
			"/auth/sign-up%2F",
		]) {
			expect(getSignedInRedirect({ redirect }), redirect).toBe("/dashboard");
		}
	});

	it("falls back to afterSignIn for a malformed-encoding path", () => {
		expect(getSignedInRedirect({ redirect: "/auth/%E0%A4%A" })).toBe(
			"/dashboard",
		);
	});

	it("keeps other auth pages as targets", () => {
		expect(
			getSignedInRedirect({ redirect: "/auth/accept-invitation?id=inv_1" }),
		).toBe("/auth/accept-invitation?id=inv_1");
	});

	it("stays on the page for a signed OAuth authorization request (sig)", () => {
		expect(
			getSignedInRedirect({ sig: "abc", redirect: "/settings" }),
		).toBeNull();
		expect(getSignedInRedirect({ sig: "" })).toBeNull();
	});
});
