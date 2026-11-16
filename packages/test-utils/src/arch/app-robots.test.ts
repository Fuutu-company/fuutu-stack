import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `appMarketing.robots` / `appDocs.robots` — `/robots.txt` of the
 * marketing and docs apps. Unset must reproduce the kit output exactly;
 * an object replaces the kit fields it sets (`rules` as a whole list),
 * a function gets the kit result and returns the final one.
 */

const ROOT = join(import.meta.dirname, "../../../..");

const app = vi.hoisted(() => ({
	appMarketing: {} as Record<string, unknown>,
	appDocs: {} as Record<string, unknown>,
}));
vi.mock("@/app-marketing", () => ({
	get appMarketing() {
		return app.appMarketing;
	},
}));
vi.mock("@/app-docs", () => ({
	get appDocs() {
		return app.appDocs;
	},
}));
vi.mock("../../../../packages/env/src/marketing", () => ({
	env: { NEXT_PUBLIC_MARKETING_URL: "https://site.test" },
}));
vi.mock("../../../../packages/env/src/docs", () => ({
	env: { NEXT_PUBLIC_DOCS_URL: "https://docs.test" },
}));

type Robots = {
	rules: unknown;
	sitemap?: string | string[];
	host?: string;
};
// Non-literal paths: the routes import `@/` aliases this package's tsc
// cannot follow; vitest resolves them like any import.
const load = async (file: string) =>
	(
		(await import(/* @vite-ignore */ join(ROOT, file))) as {
			default: () => Robots;
		}
	).default;
const routes = {
	marketing: {
		robots: await load("apps/marketing/src/app/robots.ts"),
		set: (robots: unknown) => {
			app.appMarketing = { robots };
		},
		base: "https://site.test",
	},
	docs: {
		robots: await load("apps/docs/src/app/robots.ts"),
		set: (robots: unknown) => {
			app.appDocs = { robots };
		},
		base: "https://docs.test",
	},
};

beforeEach(() => {
	app.appMarketing = {};
	app.appDocs = {};
});

/** The platform's policy: search + user-triggered agents in, training out. */
const AI_POLICY = [
	{ userAgent: ["Googlebot", "OAI-SearchBot", "Claude-User"], allow: "/" },
	{ userAgent: ["GPTBot", "ClaudeBot", "CCBot"], disallow: "/" },
	{ userAgent: "*", allow: "/" },
];

for (const [name, route] of Object.entries(routes)) {
	describe(`${name} robots.txt`, () => {
		it("keeps the kit output without an app hook", () => {
			expect(route.robots()).toEqual({
				rules: [{ userAgent: "*", allow: "/" }],
				sitemap: `${route.base}/sitemap.xml`,
			});
		});

		it("replaces the kit rules with the app's rule groups, keeps the sitemap", () => {
			route.set({ rules: AI_POLICY });
			expect(route.robots()).toEqual({
				rules: AI_POLICY,
				sitemap: `${route.base}/sitemap.xml`,
			});
		});

		it("sets sitemap and host from the app object", () => {
			route.set({
				sitemap: ["https://a.test/sitemap.xml", "https://b.test/sitemap.xml"],
				host: "https://a.test",
			});
			expect(route.robots()).toEqual({
				rules: [{ userAgent: "*", allow: "/" }],
				sitemap: ["https://a.test/sitemap.xml", "https://b.test/sitemap.xml"],
				host: "https://a.test",
			});
		});

		it("passes the kit result to a function hook and returns its result", () => {
			route.set((kit: Robots) => ({
				...kit,
				rules: [...AI_POLICY.slice(0, 2), ...(kit.rules as unknown[])],
			}));
			expect(route.robots()).toEqual({
				rules: [...AI_POLICY.slice(0, 2), { userAgent: "*", allow: "/" }],
				sitemap: `${route.base}/sitemap.xml`,
			});
		});
	});
}
