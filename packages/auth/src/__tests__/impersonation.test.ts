import { describe, expect, it } from "vitest";
import { authConfig } from "../config";
import { isImpersonationExpired } from "../impersonation";
import { isBanActive } from "../types";

const NOW = new Date("2026-06-01T12:00:00Z").getTime();
const MINUTE = 60_000;

describe("authConfig.admin.impersonationMinutes", () => {
	it("defaults to one hour", () => {
		expect(authConfig.admin.impersonationMinutes).toBe(60);
	});
});

describe("isImpersonationExpired", () => {
	it("is false for a normal session, however old", () => {
		expect(
			isImpersonationExpired(
				{ impersonatedBy: null, createdAt: new Date(NOW - 1000 * MINUTE) },
				NOW,
			),
		).toBe(false);
	});

	it("is false inside the impersonation window", () => {
		expect(
			isImpersonationExpired(
				{ impersonatedBy: "admin-1", createdAt: new Date(NOW - 59 * MINUTE) },
				NOW,
			),
		).toBe(false);
	});

	it("is true once the window has passed — even if Better Auth extended expiresAt", () => {
		const refreshed = {
			impersonatedBy: "admin-1",
			createdAt: new Date(NOW - 61 * MINUTE),
			expiresAt: new Date(NOW + 1000 * MINUTE),
		};
		expect(isImpersonationExpired(refreshed, NOW)).toBe(true);
	});

	it("accepts ISO strings (cookie-cached sessions)", () => {
		expect(
			isImpersonationExpired(
				{
					impersonatedBy: "admin-1",
					createdAt: new Date(NOW - 60 * MINUTE).toISOString(),
				},
				NOW,
			),
		).toBe(true);
	});

	it("fails closed on an unreadable createdAt", () => {
		expect(
			isImpersonationExpired(
				{ impersonatedBy: "admin-1", createdAt: "not-a-date" },
				NOW,
			),
		).toBe(true);
	});

	it("is false without a session", () => {
		expect(isImpersonationExpired(null, NOW)).toBe(false);
		expect(isImpersonationExpired(undefined, NOW)).toBe(false);
	});
});

describe("isBanActive", () => {
	it("is false for users that are not banned", () => {
		expect(isBanActive({ banned: false }, NOW)).toBe(false);
		expect(isBanActive({ banned: null }, NOW)).toBe(false);
		expect(isBanActive({}, NOW)).toBe(false);
	});

	it("is true for a permanent ban", () => {
		expect(isBanActive({ banned: true, banExpires: null }, NOW)).toBe(true);
	});

	it("is true until a temporary ban expires", () => {
		expect(
			isBanActive({ banned: true, banExpires: new Date(NOW + MINUTE) }, NOW),
		).toBe(true);
	});

	it("is false once a temporary ban has expired (Date or ISO string)", () => {
		expect(
			isBanActive({ banned: true, banExpires: new Date(NOW - MINUTE) }, NOW),
		).toBe(false);
		expect(
			isBanActive(
				{ banned: true, banExpires: new Date(NOW - MINUTE).toISOString() },
				NOW,
			),
		).toBe(false);
	});

	it("fails closed on an unreadable banExpires", () => {
		expect(isBanActive({ banned: true, banExpires: "garbage" }, NOW)).toBe(
			true,
		);
	});
});
