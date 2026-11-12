import { expect, test } from "./fixtures";

type ApiKeyItem = { id: string; name: string; organizationId: string | null };

test.describe("API keys — org key from user settings", () => {
	test("creates an org key via the org picker and it authenticates on MCP", async ({
		page,
		request,
	}) => {
		const name = `e2e-org-picker-${Date.now()}`;
		const org = await request.get("/api/organizations/acme");
		expect(org.ok()).toBe(true);
		const { id: organizationId } = (await org.json()) as { id: string };

		await page.goto("/settings/api-keys");
		await page.getByRole("button", { name: "Create API key" }).first().click();
		const dialog = page.getByRole("dialog");
		await dialog.getByRole("textbox", { name: "Key name" }).fill(name);
		await dialog.getByRole("combobox", { name: "Key type" }).click();
		await page.getByRole("option", { name: "MCP" }).click();
		await expect(
			dialog.getByRole("combobox", { name: "Organization" }),
		).toContainText("Acme");
		await dialog.getByRole("button", { name: "Create key" }).click();

		const key = (
			await page.getByRole("dialog").locator("code").textContent()
		)?.trim();
		expect(key).toMatch(/^futu_sk_/);

		const list = await request.get("/api/api-keys");
		const created = ((await list.json()) as { items: ApiKeyItem[] }).items.find(
			(item) => item.name === name,
		);
		expect(created?.organizationId).toBe(organizationId);

		try {
			const res = await request.post("/api/mcp", {
				headers: {
					"content-type": "application/json",
					accept: "application/json, text/event-stream",
					"mcp-protocol-version": "2025-11-25",
					authorization: `Bearer ${key}`,
				},
				data: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
			});
			expect(res.status()).toBe(200);
			expect(await res.text()).toContain("whoami");
		} finally {
			// The plan caps API keys per org — leave none behind.
			if (created) {
				const deleted = await request.delete(`/api/api-keys/${created.id}`);
				expect(deleted.ok()).toBe(true);
			}
		}
	});
});
