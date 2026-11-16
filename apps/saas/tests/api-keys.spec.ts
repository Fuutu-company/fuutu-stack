import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { DIALOG_VIEWPORTS, expectContentInsideDialog } from "./dialog-geometry";
import { featureOff } from "./features";
import { expect, test } from "./fixtures";
import { apiKeyScopeLabel, defaultApiKeyScopes } from "./kit-catalog";

type ApiKeyItem = {
	id: string;
	name: string;
	organizationId: string | null;
	scopes: string[];
};

test.describe("API keys — org key from user settings", () => {
	test("one org key with several scopes works on oRPC and MCP", async ({
		page,
		request,
		playwright,
		baseURL,
	}) => {
		const name = `e2e-multi-scope-${Date.now()}`;
		const org = await request.get("/api/organizations/acme");
		expect(org.ok()).toBe(true);
		const { id: organizationId } = (await org.json()) as { id: string };

		await page.goto("/settings/api-keys");
		await page.getByRole("button", { name: "Create API key" }).first().click();
		const dialog = page.getByRole("dialog");
		await dialog.getByRole("textbox", { name: "Key name" }).fill(name);
		await dialog.getByRole("combobox", { name: "Key type" }).click();
		await page.getByRole("option", { name: "Organization" }).click();
		await expect(
			dialog.getByRole("combobox", { name: "Organization" }),
		).toContainText("Acme");

		// API_KEY_DEFAULT_SCOPES are pre-checked; submit needs at least one.
		const scopeBox = (scope: string) =>
			dialog.getByRole("checkbox", { name: apiKeyScopeLabel(scope) });
		const submit = dialog.getByRole("button", { name: "Create key" });
		for (const scope of ["api", "mcp"]) {
			if (defaultApiKeyScopes.includes(scope)) {
				await expect(scopeBox(scope), scope).toBeChecked();
			} else {
				await expect(scopeBox(scope), scope).not.toBeChecked();
			}
		}
		for (const scope of defaultApiKeyScopes) {
			await scopeBox(scope).uncheck();
		}
		await expect(submit).toBeDisabled();
		await scopeBox("api").check();
		await scopeBox("mcp").check();
		await expect(submit).toBeEnabled();
		await submit.click();

		const key = (
			await page.getByRole("dialog").locator("code").textContent()
		)?.trim();
		expect(key?.startsWith("futu_sk_"), "key has the futu_sk_ prefix").toBe(
			true,
		);

		const list = await request.get("/api/api-keys");
		const created = ((await list.json()) as { items: ApiKeyItem[] }).items.find(
			(item) => item.name === name,
		);
		expect(created?.organizationId).toBe(organizationId);
		expect([...(created?.scopes ?? [])].sort()).toEqual(["api", "mcp"]);

		// No session cookies: only the key authenticates these calls.
		const client = await playwright.request.newContext({
			baseURL,
			storageState: { cookies: [], origins: [] },
		});
		try {
			await page.getByRole("button", { name: "I've copied it" }).click();
			const row = page.getByRole("row", { name: new RegExp(name) });
			await expect(row.getByText("API", { exact: true })).toBeVisible();
			await expect(row.getByText("MCP", { exact: true })).toBeVisible();

			// Org keys are pinned to their org: org-scoped procedures only.
			const me = await client.get(
				`/api/api-keys?organizationId=${organizationId}`,
				{
					headers: { "x-api-key": key ?? "" },
				},
			);
			expect(me.status(), await me.text()).toBe(200);

			const mcp = await client.post("/api/mcp", {
				headers: {
					"content-type": "application/json",
					accept: "application/json, text/event-stream",
					"mcp-protocol-version": "2025-11-25",
					authorization: `Bearer ${key}`,
				},
				data: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
			});
			expect(mcp.status()).toBe(200);
			expect(await mcp.text()).toContain("whoami");
		} finally {
			await client.dispose();
			// The plan caps API keys per org — leave none behind.
			if (created) {
				const deleted = await request.delete(`/api/api-keys/${created.id}`);
				expect(deleted.ok()).toBe(true);
			}
		}
	});
});

const ORG_KEYS_PATH = "/organizations/acme/settings/api-keys";

/**
 * The revealed key starts with `futu_sk_`. Polls a boolean so a failure
 * never prints the live key.
 */
async function expectKeyShown(dialog: Locator) {
	await expect
		.poll(
			async () =>
				(await dialog.locator("code").textContent())?.startsWith("futu_sk_") ??
				false,
			{ message: "the dialog shows a futu_sk_ key" },
		)
		.toBe(true);
}

/** Creates an org key from the org settings page; leaves the reveal open. */
async function createOrgKey(page: Page, name: string) {
	await page.goto(ORG_KEYS_PATH);
	await page
		.getByRole("button", {
			name: /^(create api key|api-schlüssel erstellen)$/i,
		})
		.first()
		.click();
	const dialog = page.getByRole("dialog");
	await dialog.getByRole("textbox").first().fill(name);
	await dialog.locator("button[type='submit']").click();
	await expectKeyShown(dialog);
	return dialog;
}

/** The plan caps API keys per org — leave none behind. */
async function deleteKeysNamed(request: APIRequestContext, name: string) {
	const org = await request.get("/api/organizations/acme");
	const { id } = (await org.json()) as { id: string };
	const list = await request.get(
		`/api/api-keys?organizationId=${id}&limit=100`,
	);
	const items = ((await list.json()) as { items: ApiKeyItem[] }).items;
	for (const item of items.filter((i) => i.name === name)) {
		const deleted = await request.delete(`/api/api-keys/${item.id}`);
		expect(deleted.ok()).toBe(true);
	}
}

test.describe("API keys — created-key dialog", () => {
	for (const locale of ["en", "de"] as const) {
		test(`keeps the key and buttons inside at 375px and 1280px (${locale})`, async ({
			page,
			context,
			request,
			baseURL,
		}) => {
			await context.addCookies([
				{ name: "NEXT_LOCALE", value: locale, url: baseURL },
			]);
			const name = `e2e-geometry-${locale}-${Date.now()}`;
			try {
				// Desktop first, then shrink the open dialog to a phone.
				const viewports = [...DIALOG_VIEWPORTS].reverse();
				await page.setViewportSize(viewports[0] ?? DIALOG_VIEWPORTS[1]);
				const dialog = await createOrgKey(page, name);
				for (const viewport of viewports) {
					await page.setViewportSize(viewport);
					await expectContentInsideDialog(page, dialog);
				}
			} finally {
				await deleteKeysNamed(request, name);
			}
		});
	}
});

test.describe("API keys — shown-once dialog behaviour", () => {
	test("copy failure shows a hint, selects the key and raises no page error", async ({
		page,
		request,
	}) => {
		const errors: string[] = [];
		page.on("pageerror", (err) => errors.push(err.message));
		page.on("console", (msg) => {
			if (msg.type() === "error") errors.push(msg.text());
		});
		await page.addInitScript(() => {
			Object.defineProperty(navigator, "clipboard", {
				configurable: true,
				value: {
					writeText: () =>
						Promise.reject(new DOMException("denied", "NotAllowedError")),
				},
			});
		});
		const name = `e2e-copy-failure-${Date.now()}`;
		try {
			const dialog = await createOrgKey(page, name);
			const key = (await dialog.locator("code").textContent())?.trim() ?? "";
			await dialog.getByRole("button", { name: "Copy" }).click();
			await expect(dialog.getByRole("alert")).toHaveText(
				"Copy failed. Select the key and copy it yourself.",
			);
			const selected = await page.evaluate(
				() => window.getSelection()?.toString() ?? "",
			);
			// Lengths and a boolean only: never print the key.
			expect(selected.length, "selection length").toBe(key.length);
			expect(selected === key, "the whole key is selected").toBe(true);
			expect(errors).toEqual([]);
		} finally {
			await deleteKeysNamed(request, name);
		}
	});

	test("clicking the overlay keeps the created key open; Escape closes it", async ({
		page,
		request,
	}) => {
		const name = `e2e-overlay-${Date.now()}`;
		try {
			const dialog = await createOrgKey(page, name);
			await page.mouse.click(4, 4);
			await expectKeyShown(dialog);
			await page.keyboard.press("Escape");
			await expect(dialog).toBeHidden();
			await expect(
				page.getByRole("row", { name: new RegExp(name) }),
			).toBeVisible();
		} finally {
			await deleteKeysNamed(request, name);
		}
	});
});

test.describe("Webhooks — signing secret", () => {
	test.skip(...featureOff("webhooks"));

	test("the secret is shown in full in the shared shown-once dialog", async ({
		page,
		request,
	}) => {
		const url = `https://example.com/fuutu-e2e-${Date.now()}`;
		await page.goto("/organizations/acme/settings/webhooks");
		await page
			.getByRole("button", { name: /add webhook/i })
			.first()
			.click();
		const form = page.getByRole("dialog");
		await form.getByRole("textbox").first().fill(url);
		await form.getByRole("checkbox").first().check();
		await form.locator("button[type='submit']").click();

		const dialog = page.getByRole("dialog");
		const secret = dialog.locator("code");
		await expect(secret).not.toBeEmpty();
		await expect(secret).not.toHaveClass(/truncate/);
		await page.mouse.click(4, 4);
		await expect(secret).toBeVisible();
		await dialog.getByRole("button", { name: "I've copied it" }).click();
		await expect(dialog).toBeHidden();

		const org = await request.get("/api/organizations/acme");
		const { id } = (await org.json()) as { id: string };
		const list = await request.get(`/api/webhooks?organizationId=${id}`);
		const body = (await list.json()) as
			| { items?: { id: string; url: string }[] }
			| { id: string; url: string }[];
		const items = Array.isArray(body) ? body : (body.items ?? []);
		for (const hook of items.filter((h) => h.url === url)) {
			const deleted = await request.delete(`/api/webhooks/${hook.id}`, {
				data: { organizationId: id },
			});
			expect(deleted.ok(), await deleted.text()).toBe(true);
		}
	});
});

test.describe("API keys — org settings list", () => {
	test("the create dialog starts fresh every time it opens", async ({
		page,
	}) => {
		await page.goto(ORG_KEYS_PATH);
		const open = page.getByRole("button", { name: "Create API key" }).first();
		const dialog = page.getByRole("dialog");
		const scopeBox = (scope: string) =>
			dialog.getByRole("checkbox", { name: apiKeyScopeLabel(scope) });

		await open.click();
		await dialog.getByRole("textbox", { name: "Key name" }).fill("draft");
		for (const scope of defaultApiKeyScopes) await scopeBox(scope).uncheck();
		await page.keyboard.press("Escape");
		await expect(dialog).toBeHidden();

		await open.click();
		await expect(dialog.getByRole("textbox", { name: "Key name" })).toHaveValue(
			"",
		);
		for (const scope of defaultApiKeyScopes) {
			await expect(scopeBox(scope)).toBeChecked();
		}
	});

	test("load more fetches the next page instead of dropping keys", async ({
		page,
		request,
	}) => {
		const org = await request.get("/api/organizations/acme");
		const { id: organizationId } = (await org.json()) as { id: string };
		const name = `e2e-page-two-${Date.now()}`;
		const created = await request.post("/api/api-keys", {
			data: { name, organizationId, scopes: ["api"] },
		});
		expect(created.ok(), await created.text()).toBe(true);
		try {
			// One key per page, so a second page exists with the seeded keys.
			await page.route("**/api/rpc/apiKeys/list", async (route) => {
				const body = route.request().postDataJSON() as {
					json: Record<string, unknown>;
				};
				await route.continue({
					postData: JSON.stringify({
						...body,
						json: { ...body.json, limit: 1 },
					}),
				});
			});
			await page.goto(ORG_KEYS_PATH);
			const rows = page.locator("tbody tr");
			await expect(rows).toHaveCount(1);
			const loadMore = page.getByRole("button", { name: "Load more" });
			await expect(loadMore).toBeVisible();
			await loadMore.click();
			await expect(rows).toHaveCount(2);
		} finally {
			await deleteKeysNamed(request, name);
		}
	});

	test("a member sees Revoke only on org keys they created", async ({
		browser,
		baseURL,
	}) => {
		const context = await browser.newContext({
			baseURL,
			storageState: { cookies: [], origins: [] },
		});
		await context.addCookies([
			{ name: "fuutu.consent.v1", value: "granted", url: baseURL },
		]);
		const page = await context.newPage();
		const name = `e2e-member-own-${Date.now()}`;
		try {
			await page.goto("/auth/sign-in");
			await page.getByLabel("Email").fill("member@fuutu.local");
			await page.getByLabel("Password").fill("DevPassword!2345");
			await page.getByRole("button", { name: "Sign in", exact: true }).click();
			await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 30_000 });

			const dialog = await createOrgKey(page, name);
			await dialog.getByRole("button", { name: "I've copied it" }).click();

			// Seeded by the admin: visible, but not revocable by a member.
			const adminRow = page.getByRole("row", { name: /Acme CI\/CD/ });
			await expect(adminRow).toBeVisible();
			await expect(
				adminRow.getByRole("button", { name: "Revoke" }),
			).toHaveCount(0);

			const ownRow = page.getByRole("row", { name: new RegExp(name) });
			await ownRow.getByRole("button", { name: "Revoke" }).click();
			await page
				.getByRole("dialog")
				.getByRole("button", { name: "Revoke key" })
				.click();
			await expect(ownRow).toBeHidden();
		} finally {
			await deleteKeysNamed(context.request, name);
			await context.close();
		}
	});
});
