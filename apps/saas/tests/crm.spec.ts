import { expect, test } from "./fixtures";

test.describe("CRM contacts", () => {
	test("crm page renders with title and new contact button", async ({
		page,
	}) => {
		await page.goto("/organizations/acme/crm");
		expect(page.url()).not.toMatch(/\/auth\/sign-in/);

		await expect(page.getByRole("heading", { name: /^crm$/i })).toBeVisible({
			timeout: 10_000,
		});

		await expect(
			page.getByRole("button", { name: /new contact/i }),
		).toBeVisible({ timeout: 10_000 });
	});

	test("can open the new contact dialog and fill the form", async ({
		page,
	}) => {
		await page.goto("/organizations/acme/crm");

		const newContactButton = page.getByRole("button", {
			name: /new contact/i,
		});
		await expect(newContactButton).toBeVisible({ timeout: 10_000 });
		await newContactButton.click();

		await expect(
			page.getByRole("dialog", { name: /new contact/i }),
		).toBeVisible({ timeout: 10_000 });

		await expect(page.getByLabel(/full name/i)).toBeVisible({
			timeout: 10_000,
		});

		await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 10_000 });

		await expect(page.getByRole("combobox", { name: /status/i })).toBeVisible({
			timeout: 10_000,
		});
	});

	test("can create a contact and see it in the list", async ({ page }) => {
		const contactName = `QA Contact ${Date.now()}`;

		await page.goto("/organizations/acme/crm");

		const newContactButton = page.getByRole("button", {
			name: /new contact/i,
		});
		await expect(newContactButton).toBeVisible({ timeout: 10_000 });
		await newContactButton.click();

		const dialog = page.getByRole("dialog", { name: /new contact/i });
		await expect(dialog).toBeVisible({ timeout: 10_000 });

		await page.getByLabel(/full name/i).fill(contactName);
		await page
			.getByLabel(/email/i)
			.fill(`qa-contact-${Date.now()}@example.com`);

		await page.getByRole("button", { name: /^save$/i }).click();

		await expect(page.getByText(contactName)).toBeVisible({
			timeout: 10_000,
		});
	});
});
