import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: every app-owned extension file carries the app-owned header
 * and stays wired into the kit code that reads it. If a kit refactor
 * drops one of these imports, an app's customisation would silently stop
 * applying — this fails instead.
 */

const ROOT = join(import.meta.dirname, "../../../..");
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

const HEADER =
	"App-owned — the kit never changes this file's content after release; fill it for your app.";

/** Comment text with the `*` gutters and line breaks folded away. */
const commentText = (source: string) =>
	source
		.replace(/^\s*\*\s?/gm, "")
		.replace(/\s+/g, " ")
		.trim();

const EXTENSION_POINTS: {
	file: string;
	exports: string[];
	wiredInto: { file: string; import: RegExp }[];
}[] = [
	{
		file: "apps/saas/src/app-navigation.ts",
		exports: [
			"appOrgSettingsNavItems",
			"appAccountNavItems",
			"appAdminNavItems",
			"appBreadcrumbLabels",
		],
		wiredInto: [
			{
				file: "apps/saas/src/modules/app/components/nav-config.ts",
				import: /from "\.\.\/\.\.\/\.\.\/app-navigation"/,
			},
			{
				file: "apps/saas/src/modules/app/components/breadcrumbs.ts",
				import: /from "\.\.\/\.\.\/\.\.\/app-navigation"/,
			},
		],
	},
	{
		file: "apps/saas/src/app-onboarding.tsx",
		exports: ["appOnboardingSteps"],
		wiredInto: [
			{
				file: "apps/saas/src/modules/app/onboarding/onboarding-wizard.tsx",
				import: /\{ appOnboardingSteps \} from "@\/app-onboarding"/,
			},
		],
	},
	{
		file: "apps/saas/src/app-onboarding.server.ts",
		exports: ["appCanCompleteOnboarding"],
		wiredInto: [
			{
				file: "apps/saas/src/modules/app/onboarding/actions.ts",
				import:
					/\{ appCanCompleteOnboarding \} from "@\/app-onboarding\.server"/,
			},
		],
	},
	{
		file: "apps/saas/src/app-slots.tsx",
		exports: ["appSlots"],
		wiredInto: [
			"apps/saas/src/app/(app)/settings/page.tsx",
			"apps/saas/src/app/(app)/organizations/[slug]/settings/billing/page.tsx",
			"apps/saas/src/app/(app)/dashboard/page.tsx",
			"apps/saas/src/app/(app)/organizations/[slug]/dashboard/page.tsx",
		].map((file) => ({ file, import: /\{ appSlots \} from "@\/app-slots"/ })),
	},
	{
		file: "apps/saas/src/server-init.ts",
		exports: ["registerApp"],
		wiredInto: [
			{
				file: "apps/saas/src/instrumentation.ts",
				import: /\{ registerApp \} = await import\("\.\/server-init"\)/,
			},
		],
	},
	{
		file: "packages/env/src/app-env.ts",
		exports: ["appServerEnv", "appClientEnv", "appClientRuntimeEnv"],
		wiredInto: [
			{ file: "packages/env/src/saas.ts", import: /from "\.\/app-env"/ },
			{ file: "packages/env/src/public.ts", import: /from "\.\/app-env"/ },
		],
	},
	{
		file: "packages/cron/src/app-jobs.ts",
		exports: ["appJobs"],
		wiredInto: [
			{
				file: "packages/cron/src/jobs/index.ts",
				import: /\{ appJobs \} from "\.\.\/app-jobs"/,
			},
		],
	},
	{
		file: "apps/docs/src/app-docs.tsx",
		exports: ["appDocs"],
		wiredInto: [
			"apps/docs/src/mdx-components.tsx",
			"apps/docs/src/app/[locale]/docs/layout.tsx",
			"apps/docs/src/app/[locale]/docs/[[...slug]]/page.tsx",
			"apps/docs/src/app/llms.mdx/[locale]/docs/[[...slug]]/route.ts",
			"apps/docs/src/app/llms-full.txt/route.ts",
			"apps/docs/src/app/og/docs/[...slug]/route.tsx",
			"apps/docs/src/app/sitemap.ts",
		].map((file) => ({
			file,
			import: /\{ appDocs \} from "(\.\/|@\/)app-docs"/,
		})),
	},
	{
		file: "apps/docs/app-docs-source.ts",
		exports: ["appDocsSource"],
		wiredInto: [
			{
				file: "apps/docs/source.config.ts",
				import: /\{ appDocsSource \} from "\.\/app-docs-source"/,
			},
			{
				file: "apps/docs/src/lib/app-docs-hooks.ts",
				import: /\{ appDocsSource \} from "\.\.\/\.\.\/app-docs-source"/,
			},
		],
	},
	{
		file: "apps/marketing/src/app-marketing.tsx",
		exports: ["appMarketing"],
		wiredInto: [
			"apps/marketing/src/app/(marketing)/[locale]/page.tsx",
			"apps/marketing/src/app/(marketing)/[locale]/layout.tsx",
			"apps/marketing/src/app/(marketing)/[locale]/pricing/page.tsx",
			"apps/marketing/src/modules/marketing/pricing/index.ts",
			"apps/marketing/src/app/sitemap.ts",
		].map((file) => ({
			file,
			import: /\{ appMarketing \} from "@\/app-marketing"/,
		})),
	},
	{
		file: "apps/marketing/src/app-site-links.ts",
		exports: [
			"appNavItems",
			"appNavDropdownItems",
			"appFooterColumns",
			"appHeaderBrand",
		],
		wiredInto: [
			{
				file: "apps/marketing/src/lib/site-links.ts",
				import: /from "\.\.\/app-site-links"/,
			},
		],
	},
	{
		file: "apps/marketing/src/app-urls.ts",
		exports: ["appUrls"],
		wiredInto: [
			{
				file: "apps/marketing/src/lib/urls.ts",
				import: /\{ appUrls \} from "\.\.\/app-urls"/,
			},
		],
	},
	{
		file: "packages/db/prisma/app-seed.ts",
		exports: ["appSeed", "appSeedConfig"],
		wiredInto: [
			{
				file: "packages/db/prisma/seed.ts",
				import: /\{ appSeed, appSeedConfig \} from "\.\/app-seed"/,
			},
		],
	},
	...["apps/saas", "apps/marketing"].map((app) => ({
		file: `${app}/tests/app-excluded.ts`,
		exports: ["appExcludedTests"],
		wiredInto: [
			{
				file: `${app}/playwright.config.ts`,
				import: /\{ appExcludedTests \} from "\.\/tests\/app-excluded"/,
			},
		],
	})),
	{
		file: "apps/docs/app-redirects.ts",
		exports: ["appRedirects"],
		wiredInto: [
			{
				file: "apps/docs/next.config.ts",
				import: /\{ appRedirects \} from "\.\/app-redirects"/,
			},
		],
	},
];

describe("app-owned extension points", () => {
	for (const point of EXTENSION_POINTS) {
		describe(point.file, () => {
			const source = read(point.file);

			it("carries the app-owned header", () => {
				expect(commentText(source)).toContain(HEADER);
			});

			it("exports its extension values", () => {
				for (const name of point.exports) {
					expect(source, name).toMatch(
						new RegExp(
							`^export (const|async function|function) ${name}\\b`,
							"m",
						),
					);
				}
			});

			for (const target of point.wiredInto) {
				it(`is read by ${target.file}`, () => {
					expect(read(target.file)).toMatch(target.import);
				});
			}
		});
	}

	it("names every app-owned file app-<topic> and every export app<Name>", () => {
		for (const point of EXTENSION_POINTS) {
			const base = point.file.split("/").at(-1) ?? "";
			if (base !== "server-init.ts") {
				expect(base, point.file).toMatch(/^app-[a-z-]+(\.server)?\.tsx?$/);
			}
			for (const name of point.exports) {
				if (name === "registerApp") continue;
				expect(name, point.file).toMatch(/^app[A-Z]/);
			}
		}
	});

	it("registerApp runs only in the nodejs runtime, after the kit boot steps", () => {
		const source = read("apps/saas/src/instrumentation.ts");
		const gate = source.indexOf('process.env.NEXT_RUNTIME !== "nodejs"');
		const provider = source.indexOf(
			"setPaymentProvider(env.PAYMENTS_PROVIDER)",
		);
		const call = source.indexOf("await registerApp()");
		expect(gate).toBeGreaterThan(-1);
		expect(call).toBeGreaterThan(provider);
		expect(provider).toBeGreaterThan(gate);
	});
});
