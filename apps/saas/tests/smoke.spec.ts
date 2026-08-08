import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * Smoke tests for the SaaS app. No DB state required.
 *
 * These exist to catch the "app doesn't boot" class of regressions and to
 * verify the kit fingerprint + security headers on every release.
 */

async function gotoStable(page: Page, url: string) {
	await page.goto(url, { timeout: 60_000 });
}

test.describe("public surface", () => {
	test("/auth/sign-in renders the sign-in form", async ({ page }) => {
		const response = await page.goto("/auth/sign-in");
		expect(response?.status()).toBeLessThan(400);
		await expect(page.locator("form")).toBeVisible();
		await expect(page.getByLabel(/email/i)).toBeVisible();
	});

	test("/auth/sign-up renders the sign-up form", async ({ page }) => {
		const response = await page.goto("/auth/sign-up");
		expect(response?.status()).toBeLessThan(400);
		await expect(page.locator("form")).toBeVisible();
	});

	test("/auth/forgot-password renders", async ({ page }) => {
		const response = await page.goto("/auth/forgot-password");
		expect(response?.status()).toBeLessThan(400);
	});
});

test.describe("auth guards", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("/dashboard redirects unauthenticated users to sign-in", async ({
		page,
	}) => {
		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/auth\/sign-in/);
	});

	test("/admin redirects unauthenticated users to sign-in", async ({
		page,
	}) => {
		// Tight assertion: anything other than /auth/sign-in here would mean an auth-bypass regression.
		await page.goto("/admin");
		await expect(page).toHaveURL(/\/auth\/sign-in/);
	});
});

test.describe("webhook bypass (security rule)", () => {
	test("/api/webhooks/payments rejects unsigned POST", async ({ request }) => {
		// `/api/webhooks/*` is in PUBLIC_PREFIXES (proxy.ts), so the auth-cookie
		// guard does not apply — the only thing standing between the public
		// internet and the payment provider is the signature verification.
		// This test asserts that an unsigned request is refused.
		const res = await request.post("/api/webhooks/payments", {
			data: { event: "synthetic" },
			headers: { "content-type": "application/json" },
			failOnStatusCode: false,
		});
		expect(res.status()).toBeGreaterThanOrEqual(400);
		expect(res.status()).toBeLessThan(600);
	});
});

test.describe("API health", () => {
	test("/api/health returns 200 JSON", async ({ request }) => {
		const res = await request.get("/api/health");
		expect(res.status()).toBe(200);
		const body = (await res.json()) as { status?: string };
		expect(body.status).toBe("healthy");
	});

	test("/api/version exposes kit name + version", async ({ request }) => {
		const res = await request.get("/api/version");
		expect(res.status()).toBe(200);
		const body = (await res.json()) as { name?: string; version?: string };
		expect(body.name).toBe("Fuutu-Stack");
		expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
	});
});

test.describe("security headers + kit fingerprint", () => {
	test("every response carries X-Framework", async ({ request }) => {
		const res = await request.get("/auth/sign-in");
		expect(res.headers()["x-framework"]).toMatch(/^Fuutu-Stack\//);
	});

	test("security headers are present", async ({ request }) => {
		const res = await request.get("/auth/sign-in");
		const h = res.headers();
		expect(h["x-frame-options"]).toBe("DENY");
		expect(h["x-content-type-options"]).toBe("nosniff");
		expect(h["referrer-policy"]).toContain("strict-origin");
		expect(h["permissions-policy"]).toContain("camera=()");
		expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
	});
});

test.describe("placeholder routes", () => {
	test("/chat page loads with title", async ({ page }) => {
		await page.goto("/chat");
		expect(page.url()).not.toMatch(/\/auth\/sign-in/);
		await expect(page.getByRole("heading", { name: /ai chat/i })).toBeVisible({
			timeout: 10_000,
		});
	});

	test("/crm page loads with title", async ({ page }) => {
		await page.goto("/crm");
		expect(page.url()).not.toMatch(/\/auth\/sign-in/);
		await expect(page.getByRole("heading", { name: /^crm$/i })).toBeVisible({
			timeout: 10_000,
		});
	});

	test("/chat and /crm don't have console errors", async ({ page }) => {
		const errors: string[] = [];
		page.on("pageerror", (err) => {
			errors.push(err.message);
		});
		page.on("console", (msg) => {
			if (msg.type() === "error") {
				errors.push(msg.text());
			}
		});

		await gotoStable(page, "/chat");
		await gotoStable(page, "/crm");

		expect(errors).toEqual([]);
	});

	test("dashboard and org routes don't have console errors", async ({
		page,
	}) => {
		const errors: string[] = [];
		page.on("pageerror", (err) => {
			errors.push(err.message);
		});
		page.on("console", (msg) => {
			if (msg.type() === "error") {
				errors.push(msg.text());
			}
		});

		await gotoStable(page, "/dashboard");
		await gotoStable(page, "/organizations/acme/dashboard");
		await gotoStable(page, "/organizations/acme/settings");
		await gotoStable(page, "/settings");

		expect(errors).toEqual([]);
	});
});
