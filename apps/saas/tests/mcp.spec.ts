import { createHash, randomBytes } from "node:crypto";
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
		const { id, key } = (await created.json()) as { id: string; key: string };
		const auth = { authorization: `Bearer ${key}` };

		try {
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
		} finally {
			// The plan caps API keys per org — leave none behind so the suite
			// stays re-runnable against the same database.
			const deleted = await request.delete(`/api/api-keys/${id}`);
			expect(deleted.ok()).toBe(true);
		}
	});
});

type AuthServerMetadata = {
	issuer: string;
	authorization_endpoint: string;
	token_endpoint: string;
	registration_endpoint: string;
	code_challenge_methods_supported: string[];
};

async function authServerMetadata(request: APIRequestContext) {
	const res = await request.get("/.well-known/oauth-authorization-server");
	expect(res.status()).toBe(200);
	return (await res.json()) as AuthServerMetadata;
}

// Loopback redirect URI of a native client (Claude Code, Cursor, VS Code).
const REDIRECT_URI = "http://127.0.0.1:33418/callback";

async function registerPublicClient(
	request: APIRequestContext,
	clientName = "E2E MCP Client",
) {
	const { registration_endpoint } = await authServerMetadata(request);
	const res = await request.post(registration_endpoint, {
		data: {
			client_name: clientName,
			redirect_uris: [REDIRECT_URI],
			token_endpoint_auth_method: "none",
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
		},
	});
	expect(res.ok()).toBe(true);
	return (await res.json()) as { client_id: string; client_secret?: string };
}

test.describe("MCP OAuth — discovery", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("serves authorization-server metadata at the root", async ({
		request,
	}) => {
		const meta = await authServerMetadata(request);
		expect(meta.authorization_endpoint).toMatch(/\/oauth2\/authorize$/);
		expect(meta.token_endpoint).toMatch(/\/oauth2\/token$/);
		expect(meta.registration_endpoint).toMatch(/\/oauth2\/register$/);
		expect(meta.code_challenge_methods_supported).toContain("S256");
	});

	test("serves protected-resource metadata for /api/mcp", async ({
		request,
	}) => {
		const meta = await authServerMetadata(request);
		for (const path of [
			"/.well-known/oauth-protected-resource/api/mcp",
			"/.well-known/oauth-protected-resource",
		]) {
			const res = await request.get(path);
			expect(res.status()).toBe(200);
			const body = (await res.json()) as {
				resource: string;
				authorization_servers: string[];
			};
			expect(body.resource).toMatch(/\/api\/mcp$/);
			// Clients fetch the AS metadata from this issuer — it must match.
			expect(body.authorization_servers).toEqual([meta.issuer]);
		}
	});

	test("answers an unknown bearer with 401 + resource_metadata challenge", async ({
		request,
	}) => {
		const res = await request.post("/api/mcp", {
			headers: { ...MCP_HEADERS, authorization: "Bearer not-a-jwt" },
			data: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
		});
		expect(res.status()).toBe(401);
		expect(res.headers()["www-authenticate"]).toMatch(
			/^Bearer resource_metadata=".+\/\.well-known\/oauth-protected-resource\/api\/mcp"$/,
		);
	});

	test("registers a public client via dynamic client registration", async ({
		request,
	}) => {
		const client = await registerPublicClient(request);
		expect(client.client_id).toEqual(expect.any(String));
		expect(client.client_secret).toBeUndefined();
	});

	test("rejects oversized registrations", async ({ request }) => {
		const { registration_endpoint } = await authServerMetadata(request);
		const res = await request.post(registration_endpoint, {
			data: {
				client_name: "x".repeat(101),
				redirect_uris: [REDIRECT_URI],
				token_endpoint_auth_method: "none",
			},
		});
		expect(res.status()).toBe(400);
		expect(await res.json()).toMatchObject({
			error: "invalid_client_metadata",
		});
	});
});

test.describe("MCP OAuth — authorization code flow", () => {
	test("consent issues a token that unlocks authenticated tools", async ({
		page,
		playwright,
		baseURL,
	}) => {
		// The MCP client side (registration, token exchange, tool calls)
		// carries no browser cookies — only the consent happens in the page.
		const request = await playwright.request.newContext({
			baseURL,
			storageState: { cookies: [], origins: [] },
		});
		const meta = await authServerMetadata(request);
		const { client_id } = await registerPublicClient(request);
		const prm = (await (
			await request.get("/.well-known/oauth-protected-resource/api/mcp")
		).json()) as { resource: string };

		const verifier = randomBytes(32).toString("base64url");
		const challenge = createHash("sha256").update(verifier).digest("base64url");
		const authorizeUrl = new URL(meta.authorization_endpoint);
		authorizeUrl.search = new URLSearchParams({
			response_type: "code",
			client_id,
			redirect_uri: REDIRECT_URI,
			scope: "openid profile",
			state: "e2e-state",
			code_challenge: challenge,
			code_challenge_method: "S256",
			resource: prm.resource,
		}).toString();

		// Consent is bound to the session's active organization → org claim.
		const active = await page.request.post(
			"/api/auth/organization/set-active",
			{
				headers: { origin: baseURL ?? "" },
				data: { organizationSlug: "acme" },
			},
		);
		expect(active.ok()).toBe(true);

		// The loopback callback has no server — answer it in the browser.
		await page.route(`${REDIRECT_URI}**`, (route) =>
			route.fulfill({ status: 200, body: "ok" }),
		);

		await page.goto(authorizeUrl.toString());
		await expect(page).toHaveURL(/\/auth\/consent\?/);
		await expect(
			page.getByRole("heading", { name: "Authorize E2E MCP Client" }),
		).toBeVisible();
		// Dynamically registered → unverified; the redirect target and the
		// organization are shown next to the self-chosen name.
		await expect(page.getByTestId("consent-unverified")).toContainText(
			"Unverified app",
		);
		await expect(page.getByTestId("consent-redirect-host")).toHaveText(
			"127.0.0.1:33418",
		);
		await expect(
			page.getByText(
				/E2E MCP Client will be able to use .+ tools as you in Acme\./,
			),
		).toBeVisible();
		await page.getByRole("button", { name: "Allow" }).click();
		await page.waitForURL((url) => url.href.startsWith(REDIRECT_URI));

		const callback = new URL(page.url());
		expect(callback.searchParams.get("state")).toBe("e2e-state");
		const code = callback.searchParams.get("code");
		expect(code).toBeTruthy();

		const tokenRes = await request.post(meta.token_endpoint, {
			form: {
				grant_type: "authorization_code",
				code: code ?? "",
				redirect_uri: REDIRECT_URI,
				client_id,
				code_verifier: verifier,
				resource: prm.resource,
			},
		});
		expect(tokenRes.ok()).toBe(true);
		const { access_token } = (await tokenRes.json()) as {
			access_token: string;
		};

		const me = await rpc(
			request,
			"tools/call",
			{ name: "whoami", arguments: {} },
			{ authorization: `Bearer ${access_token}` },
		);
		expect(me.status).toBe(200);
		expect(me.body.result?.structuredContent).toMatchObject({
			user: { email: "admin@fuutu.local" },
			organization: { slug: "acme" },
			scopes: ["openid", "profile"],
		});
		await request.dispose();
	});
});

test.describe("MCP OAuth — signed-out user", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("sign-in continues the authorization request to consent", async ({
		page,
		request,
	}) => {
		const meta = await authServerMetadata(request);
		const { client_id } = await registerPublicClient(request);
		const authorizeUrl = new URL(meta.authorization_endpoint);
		authorizeUrl.search = new URLSearchParams({
			response_type: "code",
			client_id,
			redirect_uri: REDIRECT_URI,
			scope: "openid profile",
			state: "e2e-signin",
			code_challenge: createHash("sha256")
				.update(randomBytes(32).toString("base64url"))
				.digest("base64url"),
			code_challenge_method: "S256",
		}).toString();

		await page.goto(authorizeUrl.toString());
		await expect(page).toHaveURL(/\/auth\/sign-in\?/);
		await page.getByLabel("Email").fill("admin@fuutu.local");
		await page.getByLabel("Password").fill("DevPassword!2345");
		await page.getByRole("button", { name: "Sign in", exact: true }).click();

		await expect(page).toHaveURL(/\/auth\/consent\?/);
		await expect(
			page.getByRole("heading", { name: "Authorize E2E MCP Client" }),
		).toBeVisible();
		await expect(page.getByRole("button", { name: "Deny" })).toBeVisible();
	});
});

function pkcePair() {
	const verifier = randomBytes(32).toString("base64url");
	const challenge = createHash("sha256").update(verifier).digest("base64url");
	return { verifier, challenge };
}

test.describe("MCP OAuth — unverified clients", () => {
	test("prompt=none and authorize errors land on the app error page, not the client", async ({
		page,
		playwright,
		baseURL,
	}) => {
		const request = await playwright.request.newContext({
			baseURL,
			storageState: { cookies: [], origins: [] },
		});
		const meta = await authServerMetadata(request);
		const { client_id } = await registerPublicClient(request);
		await request.dispose();

		// Anything reaching the client's callback would be an open redirect.
		let reachedClient = false;
		await page.route(`${REDIRECT_URI}**`, (route) => {
			reachedClient = true;
			return route.fulfill({ status: 200, body: "ok" });
		});

		const variants: Record<string, string>[] = [
			{ prompt: "none" },
			{ scope: "openid not-a-scope" },
		];
		for (const extra of variants) {
			const url = new URL(meta.authorization_endpoint);
			url.search = new URLSearchParams({
				response_type: "code",
				client_id,
				redirect_uri: REDIRECT_URI,
				scope: "openid",
				state: "e2e",
				code_challenge: pkcePair().challenge,
				code_challenge_method: "S256",
				...extra,
			}).toString();
			await page.goto(url.toString());
			await expect(page).toHaveURL(/\/auth\/error\?error=/);
			await expect(
				page.getByRole("heading", { name: "Something went wrong" }),
			).toBeVisible();
		}
		expect(reachedClient).toBe(false);
	});
});

test.describe("MCP OAuth — connected apps", () => {
	test("revoking a connected app makes its refresh token unusable", async ({
		page,
		playwright,
		baseURL,
	}) => {
		const clientName = `E2E Revoke ${randomBytes(4).toString("hex")}`;
		const request = await playwright.request.newContext({
			baseURL,
			storageState: { cookies: [], origins: [] },
		});
		const meta = await authServerMetadata(request);
		const { client_id } = await registerPublicClient(request, clientName);
		const { verifier, challenge } = pkcePair();
		const authorizeUrl = new URL(meta.authorization_endpoint);
		authorizeUrl.search = new URLSearchParams({
			response_type: "code",
			client_id,
			redirect_uri: REDIRECT_URI,
			scope: "openid profile offline_access",
			state: "e2e-revoke",
			code_challenge: challenge,
			code_challenge_method: "S256",
		}).toString();

		const active = await page.request.post(
			"/api/auth/organization/set-active",
			{
				headers: { origin: baseURL ?? "" },
				data: { organizationSlug: "acme" },
			},
		);
		expect(active.ok()).toBe(true);

		await page.route(`${REDIRECT_URI}**`, (route) =>
			route.fulfill({ status: 200, body: "ok" }),
		);
		await page.goto(authorizeUrl.toString());
		await expect(page).toHaveURL(/\/auth\/consent\?/);
		await expect(page.getByText(/offline access/)).toBeVisible();
		await page.getByRole("button", { name: "Allow" }).click();
		await page.waitForURL((url) => url.href.startsWith(REDIRECT_URI));
		const code = new URL(page.url()).searchParams.get("code") ?? "";

		const tokens = await request.post(meta.token_endpoint, {
			form: {
				grant_type: "authorization_code",
				code,
				redirect_uri: REDIRECT_URI,
				client_id,
				code_verifier: verifier,
			},
		});
		expect(tokens.ok()).toBe(true);
		const { refresh_token } = (await tokens.json()) as {
			refresh_token?: string;
		};
		expect(refresh_token).toBeTruthy();

		// The refresh token works before the revoke (and rotates).
		const refreshed = await request.post(meta.token_endpoint, {
			form: {
				grant_type: "refresh_token",
				refresh_token: refresh_token ?? "",
				client_id,
			},
		});
		expect(refreshed.ok()).toBe(true);
		const rotated = ((await refreshed.json()) as { refresh_token: string })
			.refresh_token;

		await page.goto("/settings?tab=sessions");
		const row = page
			.getByTestId("connected-app")
			.filter({ hasText: clientName });
		await expect(row).toBeVisible();
		await expect(row).toContainText("Unverified");
		await expect(row).toContainText("Acme");
		await expect(row).toContainText("offline_access");
		await row.getByRole("button", { name: "Revoke" }).click();
		await expect(row).toHaveCount(0);

		const afterRevoke = await request.post(meta.token_endpoint, {
			form: {
				grant_type: "refresh_token",
				refresh_token: rotated,
				client_id,
			},
		});
		expect(afterRevoke.ok()).toBe(false);
		expect(await afterRevoke.json()).toMatchObject({ error: "invalid_grant" });
		await request.dispose();
	});
});
