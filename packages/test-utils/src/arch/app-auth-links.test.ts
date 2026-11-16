import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * Auth link pages of the SaaS app (`apps/saas/src/lib/auth-links.ts`):
 * `/auth/verify-email-change` reports success only when the session's
 * email really is the new one, and `/auth/reset-password` shows its form
 * only for a token Better Auth still knows.
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
