import { expect, test as setup } from "@playwright/test";

const AUTH_FILE = "tests/.auth/user.json";

setup("authenticate as seeded admin user", async ({ page, request }) => {
	await request
		.get("/api/health")
		.then((res) => expect(res.status()).toBe(200));

	await page.goto("/auth/sign-in");

	await page.getByLabel("Email").fill("admin@fuutu.local");
	await page.getByLabel("Password").fill("DevPassword!2345");
	await page.getByRole("button", { name: "Sign in", exact: true }).click();

	await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 30_000 });
	await expect(page).toHaveURL(/\/dashboard|\/onboarding/);

	await page.context().storageState({ path: AUTH_FILE });
});
