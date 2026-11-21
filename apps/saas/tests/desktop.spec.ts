import { config } from "@fuutu/config";
import { desktopConfig } from "@fuutu/desktop/config";
import { featureOff } from "./features";
import { expect, test } from "./fixtures";

/**
 * Desktop app module (`config.features.desktop`): account settings page,
 * release routes. The app itself is checked over MCP
 * (`pnpm -F @fuutu/desktop-app smoke`, check-in-desktop skill).
 */

test.describe("desktop module switched off", () => {
	test.skip(config.features.desktop, "config.features.desktop is on");

	test("release routes answer 404", async ({ request }) => {
		expect((await request.get("/api/desktop/download")).status()).toBe(404);
		expect(
			(await request.get("/api/desktop/updates/darwin/aarch64/1.0.0")).status(),
		).toBe(404);
	});
});

test.describe("desktop app settings", () => {
	test.skip(...featureOff("desktop"));

	test("shows the download card and the signed-in devices", async ({
		page,
	}) => {
		await page.goto("/settings/desktop");
		expect(page.url()).not.toMatch(/\/auth\/sign-in/);
		await expect(
			page.getByRole("heading", { name: /^desktop app$/i }),
		).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText(/^download$/i).first()).toBeVisible();
		await expect(page.getByText(/signed-in devices/i)).toBeVisible();
	});

	test("lists the current release without user data", async ({ request }) => {
		const res = await request.get("/api/desktop/download");
		expect(res.status()).toBe(200);
		const body = (await res.json()) as {
			version: unknown;
			platforms: unknown;
		};
		expect(Object.keys(body).sort()).toEqual(["platforms", "version"]);
		expect(Array.isArray(body.platforms)).toBe(true);
	});

	test("the update endpoint needs the app's token", async ({ playwright }) => {
		test.skip(
			desktopConfig.auth !== "required",
			"desktop auth is not required",
		);
		// A fresh context: no browser session, no token.
		const anonymous = await playwright.request.newContext({
			baseURL: test.info().project.use.baseURL,
		});
		const res = await anonymous.get(
			"/api/desktop/updates/darwin/aarch64/1.0.0?channel=stable",
		);
		expect(res.status()).toBe(401);
		const forged = await anonymous.get(
			"/api/desktop/updates/darwin/aarch64/1.0.0",
			{ headers: { authorization: "Bearer forged.token.value" } },
		);
		expect(forged.status()).toBe(401);
		await anonymous.dispose();
	});
});
