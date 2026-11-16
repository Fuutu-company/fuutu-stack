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

beforeAll(async () => {
	vi.stubEnv("SKIP_ENV_VALIDATION", "1");
	vi.stubEnv("NODE_ENV", "production");
	for (const app of ["saas", "marketing", "docs"]) {
		const mod = (await import(
			/* @vite-ignore */ join(APPS, app, "next.config.ts")
		)) as { default: { headers: () => Promise<HeaderRule[]> } };
		rules.set(app, await mod.default.headers());
	}
	vi.unstubAllEnvs();
});

/** Headers for `path` — a later rule overrides an earlier one per key. */
function headersFor(app: string, path: string): Map<string, string> {
	const out = new Map<string, string>();
	for (const rule of rules.get(app) ?? []) {
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
