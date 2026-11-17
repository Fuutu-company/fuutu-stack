import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * Auth link pages of the SaaS app (`apps/saas/src/lib/auth-links.ts`):
 * `/auth/verify-email-change` reports success only when the session's
 * email really is the new one, and `/auth/reset-password` shows its form
 * only for a token Better Auth still knows. `/auth/verify` sends a
 * signed-out visitor to sign-in and back with the token.
 */

const AUTH_LINKS = join(
	import.meta.dirname,
	"../../../../apps/saas/src/lib/auth-links.ts",
);

type AuthLinks = {
	emailChangeOutcome: (input: {
		error?: string | null;
		expectedEmail?: string | null;
		currentEmail?: string | null;
	}) => "updated" | "pending" | "invalid";
	resetLinkIsUsable: (
		input: { token?: string | null; error?: string | null },
		tokenIsValid: (token: string) => Promise<boolean>,
	) => Promise<boolean>;
	emailVerificationFailure: (
		code: string | undefined,
	) => "sign-in" | "other-account" | "failed";
	emailVerificationSignInHref: (
		token: string,
		callbackURL: string | null,
	) => string;
};

const links = (await import(/* @vite-ignore */ AUTH_LINKS)) as AuthLinks;

describe("emailChangeOutcome", () => {
	it("reports the change once the session carries the new email", () => {
		expect(
			links.emailChangeOutcome({
				expectedEmail: "new@fuutu.local",
				currentEmail: "New@Fuutu.local",
			}),
		).toBe("updated");
	});

	it("waits for the new address after the confirmation step", () => {
		expect(
			links.emailChangeOutcome({
				expectedEmail: "new@fuutu.local",
				currentEmail: "old@fuutu.local",
			}),
		).toBe("pending");
	});

	it("never claims success for a bogus link", () => {
		// `/auth/verify-email-change?token=bogus` — no target email, no proof.
		expect(links.emailChangeOutcome({ currentEmail: "old@fuutu.local" })).toBe(
			"invalid",
		);
		expect(
			links.emailChangeOutcome({
				error: "INVALID_TOKEN",
				expectedEmail: "new@fuutu.local",
				currentEmail: "new@fuutu.local",
			}),
		).toBe("invalid");
		// Not signed in: nothing to compare against.
		expect(links.emailChangeOutcome({ expectedEmail: "new@fuutu.local" })).toBe(
			"invalid",
		);
	});
});

describe("resetLinkIsUsable", () => {
	it("is unusable without a token, without asking Better Auth", async () => {
		const tokenIsValid = vi.fn(async () => true);
		expect(await links.resetLinkIsUsable({}, tokenIsValid)).toBe(false);
		expect(await links.resetLinkIsUsable({ token: "" }, tokenIsValid)).toBe(
			false,
		);
		expect(tokenIsValid).not.toHaveBeenCalled();
	});

	it("is unusable when Better Auth already redirected with an error", async () => {
		expect(
			await links.resetLinkIsUsable(
				{ token: "abc", error: "INVALID_TOKEN" },
				async () => true,
			),
		).toBe(false);
	});

	it("asks Better Auth about the token", async () => {
		expect(
			await links.resetLinkIsUsable({ token: "bogus" }, async () => false),
		).toBe(false);
		expect(
			await links.resetLinkIsUsable({ token: "real" }, async (t) =>
				Promise.resolve(t === "real"),
			),
		).toBe(true);
	});
});

describe("emailVerificationFailure", () => {
	it("sends a signed-out visitor to sign-in", () => {
		expect(links.emailVerificationFailure("SIGN_IN_TO_VERIFY_EMAIL")).toBe(
			"sign-in",
		);
	});

	it("tells another account's session apart", () => {
		expect(
			links.emailVerificationFailure("EMAIL_VERIFICATION_OTHER_ACCOUNT"),
		).toBe("other-account");
	});

	it("reports every other error as failed", () => {
		expect(links.emailVerificationFailure("INVALID_TOKEN")).toBe("failed");
		expect(links.emailVerificationFailure(undefined)).toBe("failed");
	});
});

describe("emailVerificationSignInHref", () => {
	it("returns to the verify page with token and landing page after sign-in", () => {
		const href = links.emailVerificationSignInHref("t0k", "/dashboard");
		const url = new URL(href, "http://localhost");
		expect(url.pathname).toBe("/auth/sign-in");
		expect(url.searchParams.get("redirect")).toBe(
			"/auth/verify?token=t0k&callbackURL=%2Fdashboard",
		);
	});

	it("leaves out a missing landing page", () => {
		const url = new URL(
			links.emailVerificationSignInHref("t0k", null),
			"http://localhost",
		);
		expect(url.searchParams.get("redirect")).toBe("/auth/verify?token=t0k");
	});
});
