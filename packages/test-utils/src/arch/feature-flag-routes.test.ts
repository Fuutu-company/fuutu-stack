import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `config.features` flags gate the module's routes, not only its sidebar
 * link. A switched-off module's pages answer 404:
 * - full page loads: the `(app)` layout calls `notFoundIfFeatureOff()`
 *   before any `loading.tsx` Suspense boundary streams, so the status is
 *   a real 404 (a page-level `notFound()` under a `loading.tsx` only
 *   streams a soft 404 with status 200);
 * - client navigations (the shared layout does not re-render): each page
 *   calls `notFound()` on its own flag.
 * The API side is covered in `packages/api/src/__tests__/require-feature.test.ts`.
 */

const SAAS = join(import.meta.dirname, "../../../../apps/saas/src");
const read = (file: string) => readFileSync(join(SAAS, file), "utf8");

const flags = vi.hoisted(() => ({
	aiChat: true,
	crm: true,
	designSystem: true,
	webhooks: true,
	desktop: true,
}));

vi.mock("@fuutu/config", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@fuutu/config")>();
	return {
		...actual,
		config: {
			...actual.config,
			features: new Proxy(actual.config.features, {
				get: (target, prop, receiver) =>
					prop in flags
						? flags[prop as keyof typeof flags]
						: Reflect.get(target, prop, receiver),
			}),
		},
	};
});

// Resolved from the app — this package does not depend on @fuutu/payments.
const { paymentsConfig } = (await import(
	createRequire(join(SAAS, "../package.json")).resolve("@fuutu/payments/config")
)) as typeof import("../../../payments/src/config");
const { disabledFeatureForPath } = await import(
	"../../../../apps/saas/src/lib/feature-routes"
);

// Kit default, on unless a test turns it off — an app may ship it off.
const creditsEnabled = true;
paymentsConfig.creditsEnabled = creditsEnabled;
const billingAttachedTo = paymentsConfig.billingAttachedTo;
// Every gated feature starts on: personal billing is on while billing is
// attached to the user (the kit default "on" org mode attaches it to orgs).
beforeEach(() => {
	paymentsConfig.billingAttachedTo = "user";
});
afterEach(() => {
	flags.aiChat = true;
	flags.crm = true;
	flags.designSystem = true;
	flags.webhooks = true;
	flags.desktop = true;
	paymentsConfig.creditsEnabled = creditsEnabled;
	paymentsConfig.billingAttachedTo = billingAttachedTo;
});

const off = (
	feature:
		| "aiChat"
		| "crm"
		| "designSystem"
		| "webhooks"
		| "desktop"
		| "credits"
		| "personalBilling",
) => {
	if (feature === "credits") paymentsConfig.creditsEnabled = false;
	else if (feature === "personalBilling") {
		paymentsConfig.billingAttachedTo = "organization";
	} else flags[feature] = false;
};

const ROUTES = {
	aiChat: ["/chat", "/organizations/acme/chat", "/organizations/acme/chat/x"],
	crm: ["/crm", "/organizations/acme/crm"],
	credits: ["/settings/credits", "/organizations/acme/settings/credits"],
	designSystem: ["/design"],
	webhooks: [
		"/organizations/acme/settings/webhooks",
		"/organizations/acme/settings/webhooks/x",
	],
	personalBilling: ["/settings/billing"],
	desktop: ["/settings/desktop", "/settings/desktop/x"],
} as const;

describe("disabledFeatureForPath", () => {
	for (const [feature, paths] of Object.entries(ROUTES) as [
		keyof typeof ROUTES,
		readonly string[],
	][]) {
		it(`maps the ${feature} routes to the flag only while it is off`, () => {
			for (const path of paths) {
				expect(disabledFeatureForPath(path), path).toBeNull();
			}
			off(feature);
			for (const path of paths) {
				expect(disabledFeatureForPath(path), path).toBe(feature);
			}
		});
	}

	it("never matches other routes, even with every flag off", () => {
		for (const feature of Object.keys(ROUTES) as (keyof typeof ROUTES)[]) {
			off(feature);
		}
		for (const path of [
			"/",
			"/dashboard",
			"/chatter",
			"/crm-export",
			"/designs",
			"/settings",
			"/settings/billing-export",
			"/settings/api-keys",
			"/organizations/acme/dashboard",
			"/organizations/acme/settings/billing",
			"/organizations/acme/settings/webhooks-archive",
			"/organizations/acme/settings/credits-report",
			"/organizations/chat",
			"/organizations/acme/settings/desktop",
			"/settings/desktop-export",
			"/notifications",
		]) {
			expect(disabledFeatureForPath(path), path).toBeNull();
		}
	});
});

describe("disabledFeatureForPath — org-scoped and personal-only routes", () => {
	it("/organizations/acme/settings/webhooks is a disabled path when webhooks is off", () => {
		off("webhooks");
		expect(
			disabledFeatureForPath("/organizations/acme/settings/webhooks"),
		).toBe("webhooks");
		expect(
			disabledFeatureForPath("/organizations/acme/settings/members"),
		).toBeNull();
	});

	it("/settings/billing is disabled while billing is org-attached, org billing stays reachable", () => {
		paymentsConfig.billingAttachedTo = "organization";
		expect(disabledFeatureForPath("/settings/billing")).toBe("personalBilling");
		expect(
			disabledFeatureForPath("/organizations/acme/settings/billing"),
		).toBeNull();
		paymentsConfig.billingAttachedTo = "user";
		expect(disabledFeatureForPath("/settings/billing")).toBeNull();
	});
});

describe("route guards in the pages", () => {
	it("the (app) layout 404s a disabled module's route before rendering", () => {
		const layout = read("app/(app)/layout.tsx");
		expect(layout).toMatch(/await notFoundIfFeatureOff\(\);/);
		// Before the auth gates' redirects and before any children render.
		expect(layout.indexOf("await notFoundIfFeatureOff();")).toBeLessThan(
			layout.indexOf("await requireOnboarded();"),
		);
	});

	const PAGES: Record<string, RegExp> = {
		"app/(app)/chat/page.tsx": /if \(!config\.features\.aiChat\) notFound\(\);/,
		"app/(app)/organizations/[slug]/chat/page.tsx":
			/if \(!config\.features\.aiChat\) notFound\(\);/,
		"app/(app)/crm/page.tsx": /if \(!config\.features\.crm\) notFound\(\);/,
		"app/(app)/organizations/[slug]/crm/page.tsx":
			/if \(!config\.features\.crm\) notFound\(\);/,
		"app/(app)/settings/credits/page.tsx":
			/if \(!paymentsConfig\.creditsEnabled\) notFound\(\);/,
		"app/(app)/organizations/[slug]/settings/credits/page.tsx":
			/if \(!paymentsConfig\.creditsEnabled\) notFound\(\);/,
		"app/(app)/design/page.tsx":
			/if \(!config\.features\.designSystem\) notFound\(\);/,
		"app/(app)/organizations/[slug]/settings/webhooks/page.tsx":
			/if \(!config\.features\.webhooks\) notFound\(\);/,
		"app/(app)/settings/billing/page.tsx":
			/if \(paymentsConfig\.billingAttachedTo !== "user"\) notFound\(\);/,
		"app/(app)/settings/desktop/page.tsx":
			/if \(!config\.features\.desktop\) notFound\(\);/,
	};

	for (const [page, guard] of Object.entries(PAGES)) {
		it(`${page} calls notFound() on its flag`, () => {
			expect(read(page)).toMatch(guard);
		});
	}
});
