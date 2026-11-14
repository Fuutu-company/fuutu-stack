import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * App-owned marketing URLs (`apps/marketing/src/app-urls.ts`), merged over
 * the kit `urls` (`lib/urls.ts`): app keys are added (discord, support
 * mail, …) or replace a kit key; without app URLs `urls` is the kit set.
 */

const app = vi.hoisted(() => ({ appUrls: {} as Record<string, unknown> }));
vi.mock("../../../../apps/marketing/src/app-urls", () => ({
	get appUrls() {
		return app.appUrls;
	},
}));
vi.mock("../../../../packages/env/src/marketing", () => ({
	env: {
		NEXT_PUBLIC_MARKETING_URL: "https://site.test",
		NEXT_PUBLIC_DOCS_URL: "https://docs.site.test",
		NEXT_PUBLIC_SAAS_URL: "https://app.site.test",
	},
}));

const load = async () =>
	(await import("../../../../apps/marketing/src/lib/urls")).urls as Record<
		string,
		unknown
	>;

beforeEach(() => {
	app.appUrls = {};
	vi.resetModules();
});

describe("marketing urls", () => {
	it("is the kit set without app URLs", async () => {
		const urls = await load();
		expect(Object.keys(urls)).toEqual([
			"marketing",
			"docs",
			"app",
			"github",
			"design",
			"auth",
		]);
		expect(urls.design).toBe("https://app.site.test/design");
		expect(urls.auth).toEqual({
			signIn: "https://app.site.test/auth/sign-in",
			signUp: "https://app.site.test/auth/sign-up",
		});
	});

	it("adds app keys and lets an app key replace a kit key", async () => {
		app.appUrls = {
			discord: "https://discord.test/invite",
			contact: { supportEmail: "mailto:help@site.test" },
			github: "https://git.site.test/acme",
		};
		const urls = await load();
		expect(urls.discord).toBe("https://discord.test/invite");
		expect(urls.contact).toEqual({ supportEmail: "mailto:help@site.test" });
		expect(urls.github).toBe("https://git.site.test/acme");
		expect(urls.docs).toBe("https://docs.site.test");
	});
});
