import type { APIRequestContext } from "@playwright/test";
import { expect, test } from "./fixtures";

const MCP_HEADERS = {
	"content-type": "application/json",
	accept: "application/json, text/event-stream",
	"mcp-protocol-version": "2025-11-25",
};

type RpcBody = {
	result?: { tools?: { name: string }[]; structuredContent?: unknown };
	error?: unknown;
};

async function rpc(
	request: APIRequestContext,
	method: string,
	params: Record<string, unknown> = {},
	headers: Record<string, string> = {},
) {
	const res = await request.post("/api/mcp", {
		headers: { ...MCP_HEADERS, ...headers },
		data: { jsonrpc: "2.0", id: 1, method, params },
	});
	const text = await res.text();
	const data = text.includes("data:")
		? (text
				.split("\n")
				.filter((l) => l.startsWith("data:"))
				.pop()
				?.slice(5) ?? "{}")
		: text;
	return { status: res.status(), body: JSON.parse(data || "{}") as RpcBody };
}

const toolNames = (body: RpcBody) =>
	(body.result?.tools ?? []).map((t) => t.name);

test.describe("MCP endpoint — anonymous", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("initialize succeeds without credentials", async ({ request }) => {
		const { status } = await rpc(request, "initialize", {
			protocolVersion: "2025-11-25",
			capabilities: {},
			clientInfo: { name: "e2e", version: "1" },
		});
		expect(status).toBe(200);
	});

	test("anonymous callers only see public tools", async ({ request }) => {
		const { body } = await rpc(request, "tools/list");
		expect(toolNames(body)).toContain("app_info");
		expect(toolNames(body)).not.toContain("whoami");
	});

	test("an invalid key is rejected with 401", async ({ request }) => {
		const { status } = await rpc(
			request,
			"tools/list",
			{},
			{ authorization: "Bearer futu_sk_invalid" },
		);
		expect(status).toBe(401);
	});
});

test.describe("MCP endpoint — org API key with mcp scope", () => {
	test("unlocks authenticated tools for the key owner", async ({ request }) => {
		const org = await request.get("/api/organizations/acme");
		expect(org.ok()).toBe(true);
		const { id: organizationId } = (await org.json()) as { id: string };

		const created = await request.post("/api/api-keys", {
			data: { name: "e2e-mcp", organizationId, scopes: ["mcp"] },
		});
		expect(created.ok()).toBe(true);
		const { key } = (await created.json()) as { key: string };
		const auth = { authorization: `Bearer ${key}` };

		const list = await rpc(request, "tools/list", {}, auth);
		expect(toolNames(list.body)).toEqual(
			expect.arrayContaining(["app_info", "whoami"]),
		);

		const me = await rpc(
			request,
			"tools/call",
			{ name: "whoami", arguments: {} },
			auth,
		);
		expect(me.body.result?.structuredContent).toMatchObject({
			user: { email: "admin@fuutu.local" },
			organization: { slug: "acme" },
			scopes: ["mcp"],
		});
	});
});
