import { createHmac } from "node:crypto";
import { expect, test } from "./fixtures";

test.describe("two-factor authentication", () => {
	test("settings page has 2FA section", async ({ page }) => {
		await page.goto("/settings?tab=security");

		await expect(
			page.getByRole("heading", { name: /settings/i }),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: /two-factor authentication/i }),
		).toBeVisible();
	});

	test("2FA section is visible on the security tab", async ({ page }) => {
		await page.goto("/settings?tab=security");

		await expect(
			page.getByRole("heading", { name: /two-factor authentication/i }),
		).toBeVisible();
	});

	test("2FA enable or disable button is visible", async ({ page }) => {
		await page.goto("/settings?tab=security");

		await expect(
			page.getByRole("heading", { name: /two-factor authentication/i }),
		).toBeVisible();

		const enableButton = page.getByRole("button", { name: /enable 2fa/i });
		const disableButton = page.getByRole("button", { name: /disable 2fa/i });

		await expect(enableButton.or(disableButton)).toBeVisible();
	});
});

// RFC 4648 base32 → bytes (the otpauth `secret` parameter).
function base32Decode(input: string): Buffer {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
	let bits = 0;
	let value = 0;
	const out: number[] = [];
	for (const char of input.replace(/=+$/, "").toUpperCase()) {
		const idx = alphabet.indexOf(char);
		if (idx === -1) throw new Error(`invalid base32 character: ${char}`);
		value = (value << 5) | idx;
		bits += 5;
		if (bits >= 8) {
			out.push((value >>> (bits - 8)) & 0xff);
			bits -= 8;
		}
	}
	return Buffer.from(out);
}

// RFC 6238 TOTP: HMAC-SHA1, 30 s step, 6 digits.
function totp(secret: string, at = Date.now()): string {
	const counter = Buffer.alloc(8);
	counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
	const hmac = createHmac("sha1", base32Decode(secret))
		.update(counter)
		.digest();
	const offset = (hmac[hmac.length - 1] as number) & 0x0f;
	const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
	return (binary % 1_000_000).toString().padStart(6, "0");
}

// A 6-digit code outside the server's ±1 step acceptance window.
function wrongTotp(secret: string): string {
	const now = Date.now();
	const valid = new Set([-1, 0, 1].map((s) => totp(secret, now + s * 30_000)));
	for (let d = 0; d <= 9; d++) {
		const candidate = String(d).repeat(6);
		if (!valid.has(candidate)) return candidate;
	}
	throw new Error("unreachable");
}

test.describe("two-factor end to end", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("a refused magic-link or social sign-in tells the user to use password + code", async ({
		page,
	}) => {
		await page.goto("/auth/error?error=TWO_FACTOR_REQUIRED");
		await expect(
			page.getByText(/sign in with your password and authentication code/i),
		).toBeVisible();
		await expect(page.getByText("TWO_FACTOR_REQUIRED")).toBeVisible();
	});

	test("an unverified account cannot turn 2FA on", async ({
		playwright,
		baseURL,
	}) => {
		// Anyone can sign up with someone else's address: a TOTP secret set
		// before the mailbox is proven would lock its real owner out.
		const headers = { origin: new URL(baseURL ?? "").origin };
		const client = await playwright.request.newContext({
			baseURL,
			storageState: { cookies: [], origins: [] },
		});
		try {
			const email = `qa-2fa-unverified-${Date.now()}@fuutu.local`;
			const password = "TwoFactor!2345";
			const signUp = await client.post("/api/auth/sign-up/email", {
				data: { email, password, name: "QA Unverified" },
				headers,
			});
			expect(signUp.ok()).toBe(true);
			const enable = await client.post("/api/auth/two-factor/enable", {
				data: { password },
				headers,
			});
			expect(enable.status()).toBe(403);
			expect(await enable.json()).toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
		} finally {
			await client.dispose();
		}
	});

	test("enable in settings, then sign-in requires a TOTP or backup code", async ({
		page,
		isMobile,
		playwright,
		baseURL,
	}) => {
		test.skip(isMobile, "signs out through the desktop sidebar user menu");
		test.setTimeout(120_000);

		// Seeded, verified user of its own (2FA needs a verified email), so
		// the accounts used by other specs stay 2FA-free.
		const email = "two-factor@fuutu.local";
		const password = "DevPassword!2345";

		async function signOut() {
			await page.getByRole("button", { name: new RegExp(email) }).click();
			await page.getByRole("menuitem", { name: /sign out/i }).click();
			await expect(page).toHaveURL(/\/auth\/sign-in/);
		}

		async function signInWithPassword() {
			await page.goto("/auth/sign-in");
			await page.getByLabel("Email").fill(email);
			await page.getByLabel("Password").fill(password);
			// Enter submits: after an email sign-in the button's name gains the
			// "Last used" badge, so an exact "Sign in" name no longer matches.
			await page.getByLabel("Password").press("Enter");
		}

		// Start with 2FA off — an earlier run left it on (admin reset).
		const admin = await playwright.request.newContext({
			baseURL,
			storageState: "tests/.auth/user.json",
		});
		try {
			const headers = { origin: new URL(baseURL ?? "").origin };
			const users = await admin.get(
				`/api/admin/users?q=${encodeURIComponent(email)}`,
			);
			expect(users.ok()).toBe(true);
			const userId = (
				(await users.json()) as { items: { id: string; email: string }[] }
			).items.find((user) => user.email === email)?.id;
			expect(userId, "seeded two-factor user").toBeTruthy();
			const reset = await admin.post(
				`/api/admin/users/${userId}/two-factor/reset`,
				{ data: { reason: "E2E: start with 2FA off" }, headers },
			);
			expect(reset.ok()).toBe(true);
		} finally {
			await admin.dispose();
		}

		await signInWithPassword();
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

		// Enable: password → setup key + backup codes → authenticator code.
		await page.goto("/settings?tab=security");
		// The change-password form above shares the "Current password" label.
		await page.getByPlaceholder("Required to change 2FA").fill(password);
		await page.getByRole("button", { name: /enable 2fa/i }).click();

		const secret = await page.getByLabel("Setup key").inputValue();
		expect(secret).toMatch(/^[A-Z2-7]+$/);
		const backupCodes = page
			.getByRole("list", { name: "Backup codes" })
			.getByRole("listitem");
		await expect(backupCodes.first()).toBeVisible();
		const backupCode = (await backupCodes.first().innerText()).trim();

		await page.getByLabel("Authentication code").fill(wrongTotp(secret));
		await page.getByRole("button", { name: /verify and enable/i }).click();
		await expect(
			page.getByRole("alert").filter({ hasText: /not valid/i }),
		).toBeVisible();

		await page.getByLabel("Authentication code").fill(totp(secret));
		await page.getByRole("button", { name: /verify and enable/i }).click();
		await expect(page.getByRole("status")).toContainText(
			/two-factor authentication is on/i,
		);
		await expect(
			page.getByRole("button", { name: /disable 2fa/i }),
		).toBeVisible();

		// Sign-in now stops at the second factor.
		await signOut();
		await signInWithPassword();
		await expect(page).toHaveURL(/\/auth\/two-factor\?redirect=%2Fdashboard/);

		await page.getByLabel("Authentication code").fill(wrongTotp(secret));
		await page.getByRole("button", { name: "Verify", exact: true }).click();
		await expect(
			page.getByRole("alert").filter({ hasText: /not valid/i }),
		).toBeVisible();
		await expect(page).toHaveURL(/\/auth\/two-factor/);

		await page.getByLabel("Authentication code").fill(totp(secret));
		await page.getByRole("button", { name: "Verify", exact: true }).click();
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

		// Backup code path.
		await signOut();
		await signInWithPassword();
		await expect(page).toHaveURL(/\/auth\/two-factor/);
		await page.getByRole("button", { name: /use a backup code/i }).click();
		await page.getByLabel("Backup code").fill(backupCode);
		await page.getByRole("button", { name: "Verify", exact: true }).click();
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
	});
});
