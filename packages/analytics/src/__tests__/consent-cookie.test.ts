import { afterEach, describe, expect, it } from "vitest";
import { analyticsConfig } from "../config";
import { buildConsentCookie } from "../consent-cookie";

const originalDomain = analyticsConfig.consentCookieDomain;

afterEach(() => {
	analyticsConfig.consentCookieDomain = originalDomain;
});

describe("buildConsentCookie", () => {
	it("always contains name, value, max-age, path and SameSite", () => {
		const cookie = buildConsentCookie("granted");
		expect(cookie).toContain(`${analyticsConfig.consentCookieName}=granted`);
		expect(cookie).toContain(`max-age=${analyticsConfig.consentCookieMaxAge}`);
		expect(cookie).toContain("path=/");
		expect(cookie).toContain("SameSite=Lax");
	});

	it("does not set a domain attribute by default (host-scoped)", () => {
		// Regression: deriving `domain=` from the hostname sliced the last
		// two labels, so app.example.co.uk produced `domain=.co.uk` — a
		// public suffix browsers reject, meaning consent never persisted.
		// Host-scoped cookies (no domain attribute) always persist.
		expect(buildConsentCookie("granted")).not.toContain("domain=");
	});

	it("sets domain only when consentCookieDomain is explicitly configured", () => {
		analyticsConfig.consentCookieDomain = ".fuutustack.com";
		expect(buildConsentCookie("denied")).toContain("domain=.fuutustack.com");
	});

	it("adds Secure only over https", () => {
		expect(buildConsentCookie("granted", { secure: true })).toContain("Secure");
		expect(buildConsentCookie("granted", { secure: false })).not.toContain(
			"Secure",
		);
		expect(buildConsentCookie("granted")).not.toContain("Secure");
	});
});
