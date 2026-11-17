import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Auth link pages read the one-time token from `?token=` and then drop it
 * from the address bar (`apps/saas/src/lib/strip-query-param.ts`), so it
 * does not linger in history, screenshots, shared URLs or Referer headers.
 */

const SAAS = join(import.meta.dirname, "../../../../apps/saas/src");

type StripQueryParam = {
	urlWithoutQueryParam: (href: string, name: string) => string | null;
};

const { urlWithoutQueryParam } = (await import(
	/* @vite-ignore */ join(SAAS, "lib/strip-query-param.ts")
)) as StripQueryParam;

describe("urlWithoutQueryParam", () => {
	it("drops the param and keeps the rest of the URL", () => {
		expect(
			urlWithoutQueryParam(
				"https://app.example.com/auth/reset-password?token=abc&lang=de#form",
				"token",
			),
		).toBe("/auth/reset-password?lang=de#form");
	});

	it("leaves a bare path when the param was the only one", () => {
		expect(
			urlWithoutQueryParam(
				"https://app.example.com/auth/verify?token=t",
				"token",
			),
		).toBe("/auth/verify");
	});

	it("returns null when there is nothing to strip", () => {
		expect(
			urlWithoutQueryParam("https://app.example.com/auth/verify?x=1", "token"),
		).toBeNull();
	});
});
