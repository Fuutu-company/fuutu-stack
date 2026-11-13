import { expect, test } from "./fixtures";

test.describe("auth flows", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("sign in with valid credentials reaches dashboard", async ({ page }) => {
		await page.goto("/auth/sign-in");

		await page.getByLabel("Email").fill("admin@fuutu.local");
		await page.getByLabel("Password").fill("DevPassword!2345");
		await page.getByRole("button", { name: "Sign in", exact: true }).click();

		await expect(page).toHaveURL(/\/dashboard|\/onboarding/);
	});

	test("sign in with invalid credentials shows generic error", async ({
		page,
	}) => {
		await page.goto("/auth/sign-in");

		await page.getByLabel("Email").fill("admin@fuutu.local");
		await page.getByLabel("Password").fill("WrongPassword!9999");
		await page.getByRole("button", { name: "Sign in", exact: true }).click();

		await expect(page.getByText(/invalid email or password/i)).toBeVisible();
		await expect(page).toHaveURL(/\/auth\/sign-in/);
	});

	test("sign up form renders with required fields", async ({ page }) => {
		await page.goto("/auth/sign-up");

		await expect(page.getByLabel(/name/i)).toBeVisible();
		await expect(page.getByLabel("Email")).toBeVisible();
		await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
		await expect(page.getByLabel(/confirm password/i)).toBeVisible();
		await expect(
			page.getByRole("button", { name: /^sign up$/i }),
		).toBeVisible();
	});

	test("sign up with mismatched passwords shows error", async ({ page }) => {
		await page.goto("/auth/sign-up");

		await page.getByLabel(/name/i).fill("Test User");
		await page.getByLabel("Email").fill("testuser@example.com");
		await page
			.getByLabel("Password", { exact: true })
			.fill("TestPassword!2345");
		await page.getByLabel(/confirm password/i).fill("DifferentPassword!2345");
		await page.getByRole("button", { name: /^sign up$/i }).click();

		await expect(page.getByText(/passwords do not match/i)).toBeVisible();
	});

	test("forgot password page renders", async ({ page }) => {
		const response = await page.goto("/auth/forgot-password");
		expect(response?.status()).toBeLessThan(400);
	});

	test("passkey option renders before the email field when enabled", async ({
		page,
	}) => {
		await page.goto("/auth/sign-in");
		const email = page.getByLabel("Email");
		await expect(email).toBeVisible();

		const status = await page.evaluate(async () => {
			const res = await fetch(
				"/api/auth/passkey/generate-authenticate-options",
			);
			return res.status;
		});
		const passkey = page.getByRole("button", {
			name: /sign in with passkey/i,
		});
		if (status === 404) {
			await expect(passkey).toHaveCount(0);
			return;
		}

		await expect(passkey).toBeVisible();
		const passkeyFirst = await passkey.evaluate(
			(button, field) =>
				field
					? Boolean(
							button.compareDocumentPosition(field) &
								Node.DOCUMENT_POSITION_FOLLOWING,
						)
					: false,
			await email.elementHandle(),
		);
		expect(passkeyFirst).toBe(true);
	});

	// A provider without credentials (or disabled in authConfig) is not
	// registered by the server — its button must not render. Asserted against
	// the live server instead of the env, so it holds in any environment.
	for (const [provider, label] of [
		["google", "Sign in with Google"],
		["github", "Sign in with GitHub"],
	] as const) {
		test(`${provider} button renders exactly when the server registers ${provider}`, async ({
			page,
		}) => {
			await page.goto("/auth/sign-in");
			await expect(
				page.getByRole("button", { name: "Sign in", exact: true }),
			).toBeVisible();

			const status = await page.evaluate(async (id) => {
				const res = await fetch("/api/auth/sign-in/social", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						provider: id,
						callbackURL: "/dashboard",
						disableRedirect: true,
					}),
				});
				return res.status;
			}, provider);
			const registered = status !== 404;

			await expect(page.getByRole("button", { name: label })).toHaveCount(
				registered ? 1 : 0,
			);
		});
	}
});

// The lastLoginMethod plugin remembers the method in a readable cookie; the
// sign-in card marks that method with a "Last used" chip outside the
// button, linked through aria-describedby so the button keeps its name.
test.describe("last used sign-in method", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	const LAST_USED_COOKIE = "better-auth.last_used_login_method";

	/** The chip sits on the button's top-right edge: above its top, flush right. */
	async function expectChipOnTopRightEdge(
		page: import("@playwright/test").Page,
		button: import("@playwright/test").Locator,
	) {
		const chip = await page.getByText(/^last used$/i).boundingBox();
		const box = await button.boundingBox();
		expect(chip && box).toBeTruthy();
		if (!chip || !box) return;
		const chipRight = chip.x + chip.width;
		const buttonRight = box.x + box.width;
		expect(chip.y).toBeLessThan(box.y);
		expect(chip.y + chip.height).toBeGreaterThan(box.y);
		expect(chipRight).toBeLessThanOrEqual(buttonRight);
		expect(chipRight).toBeGreaterThan(buttonRight - 24);
	}

	test("a password sign-in marks the Sign in button as last used", async ({
		page,
	}) => {
		await page.goto("/auth/sign-in");
		await page.getByLabel("Email").fill("admin@fuutu.local");
		await page.getByLabel("Password").fill("DevPassword!2345");
		await page.getByRole("button", { name: "Sign in", exact: true }).click();
		await expect(page).toHaveURL(/\/dashboard|\/onboarding/);

		// Drop the session, keep only what the plugin remembered.
		const context = page.context();
		const remembered = (await context.cookies()).filter(
			(cookie) => cookie.name === LAST_USED_COOKIE,
		);
		expect(remembered.map((cookie) => cookie.value)).toEqual(["email"]);
		await context.clearCookies();
		await context.addCookies(remembered);

		await page.goto("/auth/sign-in");
		const submit = page.getByRole("button", { name: "Sign in", exact: true });
		await expect(submit).toHaveAccessibleDescription(/^last used$/i);
		await expect(page.getByText(/^last used$/i)).toHaveCount(1);
		await expect(page.getByText(/^last used$/i)).toBeVisible();
		await expectChipOnTopRightEdge(page, submit);
	});

	for (const [method, name] of [
		["passkey", /sign in with passkey/i],
		["magic-link", /magic link/i],
	] as const) {
		test(`${method}: only that method carries the last-used chip`, async ({
			page,
			baseURL,
		}) => {
			await page
				.context()
				.addCookies([
					{ name: LAST_USED_COOKIE, value: method, url: baseURL ?? "" },
				]);
			await page.goto("/auth/sign-in");
			const submit = page.getByRole("button", { name: "Sign in", exact: true });
			await expect(submit).toBeVisible();

			const button = page.getByRole("button", { name });
			test.skip((await button.count()) === 0, `${method} is not enabled`);

			await expect(button).toHaveAccessibleDescription(/^last used$/i);
			await expect(page.getByText(/^last used$/i)).toHaveCount(1);
			await expect(submit).not.toHaveAccessibleDescription(/last used/i);
			await expectChipOnTopRightEdge(page, button);
		});
	}

	test("without a remembered method nothing is marked", async ({ page }) => {
		await page.goto("/auth/sign-in");
		await expect(
			page.getByRole("button", { name: "Sign in", exact: true }),
		).toBeVisible();
		await expect(page.getByText(/last used/i)).toHaveCount(0);
	});
});

test.describe("sign-up page links to sign-in", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("offers Already have an account? Sign in", async ({ page }) => {
		await page.goto("/auth/sign-up");
		await expect(page.getByText(/^already have an account\?/i)).toBeVisible();
		const link = page.getByRole("link", { name: "Sign in", exact: true });
		await expect(link).toHaveAttribute("href", "/auth/sign-in");
		// Underlined like the sign-in page's "Sign up" link.
		await expect(link).toHaveCSS("text-decoration-line", "underline");
		await link.click();
		await expect(page).toHaveURL(/\/auth\/sign-in$/);
		await expect(
			page.getByRole("link", { name: "Sign up", exact: true }),
		).toHaveCSS("text-decoration-line", "underline");
	});

	test("carries a safe redirect over to sign-in", async ({ page }) => {
		const target = "/auth/accept-invitation?id=inv_123";
		await page.goto(`/auth/sign-up?redirect=${encodeURIComponent(target)}`);
		await expect(
			page.getByRole("link", { name: "Sign in", exact: true }),
		).toHaveAttribute(
			"href",
			`/auth/sign-in?redirect=${encodeURIComponent(target)}`,
		);
	});

	test("never carries an external redirect over", async ({ page }) => {
		await page.goto(
			`/auth/sign-up?redirect=${encodeURIComponent("https://evil.example.com/phish")}`,
		);
		const link = page.getByRole("link", { name: "Sign in", exact: true });
		await expect(link).toHaveAttribute("href", /^\/auth\/sign-in/);
		expect(await link.getAttribute("href")).not.toContain("evil");
	});
});

// Default storage state: signed in as the seeded admin.
test.describe("signed-in visitors on sign-in and sign-up", () => {
	for (const entry of ["sign-in", "sign-up"] as const) {
		test(`/auth/${entry} sends a signed-in user to the dashboard`, async ({
			page,
		}) => {
			await page.goto(`/auth/${entry}`);
			await expect(page).toHaveURL(/\/dashboard$/);
			await expect(
				page.getByRole("heading", { level: 1, name: /welcome back/i }),
			).toBeVisible({ timeout: 10_000 });
		});

		test(`/auth/${entry} honors a safe redirect param`, async ({ page }) => {
			await page.goto(
				`/auth/${entry}?redirect=${encodeURIComponent("/settings/api-keys")}`,
			);
			await expect(page).toHaveURL(/\/settings\/api-keys$/);
		});

		for (const evil of [
			"https://evil.example.com/phish",
			"//evil.example.com",
			"/\\evil.example.com",
			"javascript:alert(1)",
		]) {
			test(`/auth/${entry} falls back to the dashboard for ${evil}`, async ({
				page,
				baseURL,
			}) => {
				await page.goto(`/auth/${entry}?redirect=${encodeURIComponent(evil)}`);
				await expect(page).toHaveURL(/\/dashboard$/);
				expect(new URL(page.url()).origin).toBe(new URL(baseURL ?? "").origin);
			});
		}

		test(`/auth/${entry} never redirects back to an auth entry page`, async ({
			page,
		}) => {
			await page.goto(
				`/auth/${entry}?redirect=${encodeURIComponent("/auth/sign-in?redirect=/auth/sign-up")}`,
			);
			await expect(page).toHaveURL(/\/dashboard$/);
		});
	}

	test("a signed MCP OAuth request keeps the sign-in page (prompt=login)", async ({
		page,
	}) => {
		await page.goto("/auth/sign-in?client_id=c1&prompt=login&sig=abc");
		await expect(page).toHaveURL(/\/auth\/sign-in\?/);
		await expect(page.getByLabel("Email")).toBeVisible();
	});

	test("accept-invitation: a failing session check shows a retry, never a sign-in loop", async ({
		page,
	}) => {
		const target = "/auth/accept-invitation?id=inv_does_not_exist";
		let sessionChecks = 0;
		let failing = true;
		await page.route("**/api/auth/get-session**", async (route) => {
			sessionChecks += 1;
			if (!failing) return route.continue();
			return route.fulfill({
				status: 429,
				contentType: "application/json",
				body: JSON.stringify({ message: "Too many requests" }),
			});
		});
		const visited: string[] = [];
		page.on("framenavigated", (frame) => {
			if (frame === page.mainFrame()) visited.push(frame.url());
		});

		await page.goto(target);
		// Not Next's (always present) route announcer: the alert with a retry.
		const alert = page
			.getByRole("alert")
			.filter({ has: page.getByRole("button", { name: /try again/i }) });
		await expect(alert).toBeVisible({ timeout: 10_000 });
		const retry = alert.getByRole("button", { name: /try again/i });
		await expect(retry).toBeVisible();
		// Hold still for a moment: a loop would keep navigating and re-checking.
		await page.waitForTimeout(2_000);
		expect(visited.filter((url) => url.includes("/auth/sign-in"))).toEqual([]);
		await expect(page).toHaveURL(/\/auth\/accept-invitation\?id=/);
		expect(sessionChecks).toBeLessThanOrEqual(2);

		// Once the session endpoint answers, Try again resumes the normal flow.
		failing = false;
		await retry.click();
		await expect(alert).toBeHidden();
		await expect(
			page.getByRole("heading", { name: /invitation not found/i }),
		).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveURL(/\/auth\/accept-invitation\?id=/);
	});

	test("other auth pages stay reachable while signed in", async ({ page }) => {
		await page.goto("/auth/forgot-password");
		await expect(page).toHaveURL(/\/auth\/forgot-password$/);
		await page.goto("/auth/two-factor");
		await expect(page).toHaveURL(/\/auth\/two-factor$/);
	});
});
