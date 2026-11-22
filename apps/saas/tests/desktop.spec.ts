import { createHash, randomBytes } from "node:crypto";
import { config } from "@fuutu/config";
import { desktopConfig } from "@fuutu/desktop/config";
import { desktopIdentity } from "@fuutu/desktop/identity";
import { featureOff, orgsOff } from "./features";
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
			linuxFormat: unknown;
		};
		expect(Object.keys(body).sort()).toEqual([
			"linuxFormat",
			"platforms",
			"version",
		]);
		expect(Array.isArray(body.platforms)).toBe(true);
		expect([null, "appimage", "deb", "rpm"]).toContain(body.linuxFormat);
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

test.describe("desktop access token scope", () => {
	test.skip(...featureOff("desktop"));
	test.skip(desktopConfig.auth === "off", "desktop auth is off");

	const REDIRECT_URI = "http://127.0.0.1:33419/callback";

	test("reaches desktopAllowed procedures only", async ({
		page,
		playwright,
		baseURL,
	}) => {
		// The app side (token exchange, API calls) carries no browser
		// cookies — only the consent happens in the page, as in the app.
		const app = await playwright.request.newContext({
			baseURL,
			storageState: { cookies: [], origins: [] },
		});
		const origin = new URL(baseURL ?? "").origin;
		const resource = `${origin}/api/rpc`;
		const verifier = randomBytes(32).toString("base64url");
		const challenge = createHash("sha256").update(verifier).digest("base64url");
		const authorize = new URL("/api/auth/oauth2/authorize", origin);
		authorize.search = new URLSearchParams({
			response_type: "code",
			client_id: desktopIdentity.oauthClientId,
			redirect_uri: REDIRECT_URI,
			scope: "openid profile email offline_access",
			state: "e2e-desktop",
			code_challenge: challenge,
			code_challenge_method: "S256",
			resource,
		}).toString();

		// The token pins the org active at sign-in; without organizations
		// (organizationsMode "off") it is personal.
		if (!orgsOff()[0]) {
			const active = await page.request.post(
				"/api/auth/organization/set-active",
				{ headers: { origin }, data: { organizationSlug: "acme" } },
			);
			expect(active.ok()).toBe(true);
		}
		// The app's loopback listener — answered in the browser.
		await page.route(`${REDIRECT_URI}**`, (route) =>
			route.fulfill({ status: 200, body: "ok" }),
		);
		await page.goto(authorize.toString());
		await expect(page).toHaveURL(/\/auth\/consent\?/);
		await page.getByRole("button", { name: "Allow" }).click();
		await page.waitForURL((url) => url.href.startsWith(REDIRECT_URI));
		const callback = new URL(page.url());
		expect(callback.searchParams.get("state")).toBe("e2e-desktop");

		const tokenRes = await app.post("/api/auth/oauth2/token", {
			form: {
				grant_type: "authorization_code",
				code: callback.searchParams.get("code") ?? "",
				redirect_uri: REDIRECT_URI,
				client_id: desktopIdentity.oauthClientId,
				code_verifier: verifier,
				resource,
			},
		});
		expect(tokenRes.ok()).toBe(true);
		const { access_token } = (await tokenRes.json()) as {
			access_token: string;
		};
		const headers = { authorization: `Bearer ${access_token}` };

		// Marked `desktopAllowed` (users.me) — accepted; 402 only when the
		// app gates desktop API use by plan (apiConfig.apiKeyScopeFeatures
		// .desktop) and the org lacks it.
		const me = await app.get("/api/users/me", { headers });
		expect([200, 402]).toContain(me.status());
		if (me.status() === 200) {
			expect(await me.json()).toMatchObject({ email: "admin@fuutu.local" });
		}
		// Not marked (notifications.unreadCount) — refused before any plan
		// check, though a browser session or an API key reaches it.
		const unmarked = await app.get("/api/notifications/unread-count", {
			headers,
		});
		expect(unmarked.status()).toBe(403);
		await app.dispose();
	});
});
