import { expect, test } from "./fixtures";

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

		// Kit default is "api" pre-checked; submit needs at least one scope.
		const apiScope = dialog.getByRole("checkbox", { name: "API" });
		const mcpScope = dialog.getByRole("checkbox", { name: "MCP" });
		const submit = dialog.getByRole("button", { name: "Create key" });
		await expect(apiScope).toBeChecked();
		await expect(mcpScope).not.toBeChecked();
		await apiScope.click();
		await expect(submit).toBeDisabled();
		await apiScope.click();
		await mcpScope.click();
		await expect(submit).toBeEnabled();
		await submit.click();

		const key = (
			await page.getByRole("dialog").locator("code").textContent()
		)?.trim();
		expect(key).toMatch(/^futu_sk_/);

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
