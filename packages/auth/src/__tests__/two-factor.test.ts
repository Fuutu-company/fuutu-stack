import { describe, expect, it, vi } from "vitest";
import {
	getTotpSecret,
	getTwoFactorErrorKey,
	getTwoFactorPath,
	isTwoFactorRedirect,
} from "../two-factor";

vi.mock("@fuutu/env/public", () => ({
	env: { NEXT_PUBLIC_SAAS_URL: "https://app.example.com" },
}));

describe("getTotpSecret()", () => {
	it("returns the base32 secret from an otpauth URI", () => {
		expect(
			getTotpSecret(
				"otpauth://totp/Fuutu:a%40b.dev?secret=JBSWY3DPEHPK3PXP&issuer=Fuutu&digits=6&period=30",
			),
		).toBe("JBSWY3DPEHPK3PXP");
	});

	it("returns null for a URI without a secret", () => {
		expect(getTotpSecret("otpauth://totp/Fuutu:a%40b.dev?issuer=Fuutu")).toBe(
			null,
		);
	});

	it("returns null for garbage input", () => {
		expect(getTotpSecret("not a uri")).toBe(null);
	});
});

describe("isTwoFactorRedirect()", () => {
	it("detects the sign-in response that requires a second factor", () => {
		expect(
			isTwoFactorRedirect({ twoFactorRedirect: true, twoFactorMethods: [] }),
		).toBe(true);
	});

	it("is false for a normal sign-in response", () => {
		expect(isTwoFactorRedirect({ token: "t", user: { id: "u" } })).toBe(false);
		expect(isTwoFactorRedirect({ twoFactorRedirect: false })).toBe(false);
		expect(isTwoFactorRedirect(null)).toBe(false);
		expect(isTwoFactorRedirect(undefined)).toBe(false);
	});
});

describe("getTwoFactorPath()", () => {
	it("carries a safe redirect target to the verification page", () => {
		expect(getTwoFactorPath("/settings?tab=security")).toBe(
			"/auth/two-factor?redirect=%2Fsettings%3Ftab%3Dsecurity",
		);
	});

	it("replaces an unsafe redirect target with the sign-in fallback", () => {
		expect(getTwoFactorPath("https://evil.example.com")).toBe(
			"/auth/two-factor?redirect=%2Fdashboard",
		);
	});
});

describe("getTwoFactorErrorKey()", () => {
	it("maps wrong codes to invalidCode", () => {
		expect(getTwoFactorErrorKey("INVALID_CODE")).toBe("invalidCode");
		expect(getTwoFactorErrorKey("INVALID_BACKUP_CODE")).toBe("invalidCode");
	});

	it("maps a dead challenge to expired (user must sign in again)", () => {
		expect(getTwoFactorErrorKey("INVALID_TWO_FACTOR_COOKIE")).toBe("expired");
		expect(getTwoFactorErrorKey("TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE")).toBe(
			"expired",
		);
	});

	it("maps the account lockout to locked", () => {
		expect(getTwoFactorErrorKey("ACCOUNT_TEMPORARILY_LOCKED")).toBe("locked");
	});

	it("falls back to failed for anything else", () => {
		expect(getTwoFactorErrorKey(undefined)).toBe("failed");
		expect(getTwoFactorErrorKey("SOMETHING_NEW")).toBe("failed");
	});
});
