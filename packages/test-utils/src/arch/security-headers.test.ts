import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Response headers the three apps' `next.config.ts` set, resolved per path
 * the way Next matches `headers()` sources (production build).
 */

const APPS = join(import.meta.dirname, "../../../../apps");
type Header = { key: string; value: string };
type HeaderRule = { source: string; headers: Header[] };
type Matcher = (path: string) => false | object;

const { getPathMatch } = createRequire(join(APPS, "saas/package.json"))(
	"next/dist/shared/lib/router/utils/path-match",
) as {
	getPathMatch: (
		source: string,
		options: { strict: boolean; sensitive: boolean },
	) => Matcher;
};

const rules = new Map<string, HeaderRule[]>();
/** The same production build served over plain http (local `next start`). */
const httpRules = new Map<string, HeaderRule[]>();

async function loadRules(
	into: Map<string, HeaderRule[]>,
	origin: (port: number) => string,
) {
	vi.resetModules();
	vi.stubEnv("SKIP_ENV_VALIDATION", "1");
	vi.stubEnv("NODE_ENV", "production");
	vi.stubEnv("BETTER_AUTH_URL", origin(3000));
	vi.stubEnv("NEXT_PUBLIC_SAAS_URL", origin(3000));
	vi.stubEnv("NEXT_PUBLIC_MARKETING_URL", origin(3001));
	vi.stubEnv("NEXT_PUBLIC_DOCS_URL", origin(4000));
	for (const app of ["saas", "marketing", "docs"]) {
		const mod = (await import(
			/* @vite-ignore */ join(APPS, app, "next.config.ts")
		)) as { default: { headers: () => Promise<HeaderRule[]> } };
		into.set(app, await mod.default.headers());
	}
	vi.unstubAllEnvs();
}

beforeAll(async () => {
	await loadRules(rules, (port) => `https://app${port}.example.com`);
	await loadRules(httpRules, (port) => `http://localhost:${port}`);
}, 60_000);

/** Headers for `path` — a later rule overrides an earlier one per key. */
function headersFor(
	app: string,
	path: string,
	from: Map<string, HeaderRule[]> = rules,
): Map<string, string> {
	const out = new Map<string, string>();
	for (const rule of from.get(app) ?? []) {
		if (!getPathMatch(rule.source, { strict: true, sensitive: false })(path))
			continue;
		for (const { key, value } of rule.headers)
			out.set(key.toLowerCase(), value);
	}
	return out;
}

describe.each([
	["saas", "/dashboard"],
	["marketing", "/en"],
	["docs", "/en/docs"],
])("%s security headers", (app, path) => {
	it("isolates the browsing context and disables unused features", () => {
		const h = headersFor(app, path);
		expect(h.get("x-framework")).toMatch(/^Fuutu-Stack\//);
		expect(h.get("cross-origin-opener-policy")).toBe("same-origin");
		const policy = h.get("permissions-policy") ?? "";
		for (const feature of [
			"camera=()",
			"microphone=()",
			"geolocation=()",
			"payment=()",
			"usb=()",
		]) {
			expect(policy).toContain(feature);
		}
		// Retired Privacy Sandbox tokens: Chrome warns on every page.
		expect(policy).not.toMatch(/interest-cohort|browsing-topics/);
		expect(h.get("x-dns-prefetch-control")).not.toBe("on");
		expect(h.get("content-security-policy")).toContain(
			"upgrade-insecure-requests",
		);
	});

	it("does not upgrade requests when the app is served over plain http", () => {
		// WebKit then skips every CSS/JS request of a production build on
		// http://localhost (E2E and visual containers).
		const h = headersFor(app, path, httpRules);
		expect(h.get("content-security-policy")).toBeTruthy();
		expect(h.get("content-security-policy")).not.toContain(
			"upgrade-insecure-requests",
		);
		expect(h.get("x-framework")).toMatch(/^Fuutu-Stack\//);
	});
});

describe("saas", () => {
	it("keeps its resources to the same site", () => {
		expect(
			headersFor("saas", "/dashboard").get("cross-origin-resource-policy"),
		).toBe("same-site");
	});

	it("allows no CDN scripts sitewide", () => {
		const csp = headersFor("saas", "/dashboard").get("content-security-policy");
		expect(csp).toContain("script-src 'self'");
		expect(csp).not.toContain("cdn.jsdelivr.net");
	});

	it("leaves /api/docs to its own sandboxed CSP (@fuutu/api)", () => {
		const docs = headersFor("saas", "/api/docs");
		expect(docs.has("content-security-policy")).toBe(false);
		expect(docs.get("x-framework")).toMatch(/^Fuutu-Stack\//);
		expect(docs.get("x-frame-options")).toBe("DENY");
		expect(
			headersFor("saas", "/api/docsx").has("content-security-policy"),
		).toBe(true);
		expect(headersFor("saas", "/").has("content-security-policy")).toBe(true);
	});
});

/**
 * Every app with a `next.config.ts` is either header-checked above or
 * listed here with the reason it serves no HTTP responses in production —
 * a new app can never slip past this guard unnoticed.
 */
const HEADER_CHECKED_APPS = ["saas", "marketing", "docs"];
const NO_HTTP_APPS: Record<string, string> = {
	// Static export (`output: "export"`) loaded by Tauri from the app bundle
	// over its asset protocol: no server, so no response headers at all. The
	// kit fingerprint header stays on every saas response the app calls
	// (LICENSE.md §7); the export keeps the `<meta name="generator">`.
	desktop: "static export inside the desktop app — no HTTP server",
	// Local mail template preview (`pnpm dev`, port slot) — never deployed.
	"mail-preview": "development-only tool, never deployed",
};

describe("app coverage", () => {
	const apps = readdirSync(APPS).filter((app) =>
		existsSync(join(APPS, app, "next.config.ts")),
	);

	it("checks every app's headers or documents why it has none", () => {
		for (const app of apps) {
			expect(
				HEADER_CHECKED_APPS.includes(app) || app in NO_HTTP_APPS,
				`apps/${app}: add it to the header checks or NO_HTTP_APPS`,
			).toBe(true);
		}
	});

	it.skipIf(!apps.includes("desktop"))(
		"desktop is a static export without headers()",
		async () => {
			const mod = (await import(
				/* @vite-ignore */ join(APPS, "desktop", "next.config.ts")
			)) as { default: { output?: string; headers?: unknown } };
			expect(mod.default.output).toBe("export");
			expect(mod.default.headers).toBeUndefined();
			const layout = readFileSync(
				join(APPS, "desktop/src/app/layout.tsx"),
				"utf8",
			);
			expect(layout).toContain("generator: KIT_GENERATOR_META");
		},
	);
});
