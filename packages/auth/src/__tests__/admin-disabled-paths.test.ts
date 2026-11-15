import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Direct HTTP access to the Better Auth admin plugin is closed: every admin
 * endpoint is in `disabledPaths` (404), while server-side `auth.api.*` calls
 * (used by the oRPC admin procedures) keep working.
 */

vi.mock("@fuutu/env/saas", () => ({
	env: {
		BETTER_AUTH_URL: "http://localhost:3000",
		BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-12",
		CORS_ORIGIN: "http://localhost:3000",
		NODE_ENV: "test",
		NEXT_PUBLIC_SAAS_URL: undefined,
		FUUTU_DISABLE_RATE_LIMIT: true,
	},
}));

vi.mock("@fuutu/db", () => ({
	getUserByEmail: vi.fn(),
	prismaAuditSink: vi.fn(),
	revokeOAuthTokensForUser: vi.fn(),
	claimUserCreatedEvent: vi.fn(),
	resetUserCreatedEvent: vi.fn(),
	countOrganizationMembers: vi.fn(),
	getPurchasesByUserId: vi.fn(),
	findPendingInvitation: vi.fn(),
	findPendingInvitationById: vi.fn(),
}));

vi.mock("@fuutu/db/internal/client", () => ({ db: {} }));

vi.mock("@fuutu/payments", () => ({
	createCustomerForUser: vi.fn(),
}));

vi.mock("../lib/email", () => ({ sendEmail: vi.fn() }));

vi.mock("../hooks/audit", () => ({
	logSignUp: vi.fn(),
	logSessionCreated: vi.fn(),
}));

vi.mock("../hooks/impersonation-guard", () => ({
	assertNotImpersonating: vi.fn(),
}));

const IMPORT_TIMEOUT = 30_000;

type AuthModule = typeof import("../index");
let auth: AuthModule["auth"];
let mcpOAuthActive: boolean;

beforeAll(async () => {
	({ auth } = await import("../index"));
	({
		mcpOAuth: { active: mcpOAuthActive },
	} = await import("../mcp-oauth"));
}, IMPORT_TIMEOUT);

type PluginEndpoint = {
	path?: string;
	options?: {
		method?: string | string[];
		metadata?: { SERVER_ONLY?: boolean };
	};
};

function adminEndpointPaths(): string[] {
	const plugin = auth.options.plugins?.find((p) => p.id === "admin") as
		| { endpoints?: Record<string, { path: string }> }
		| undefined;
	return Object.values(plugin?.endpoints ?? {}).map(
		(endpoint) => endpoint.path,
	);
}

describe("admin plugin HTTP surface", () => {
	it("exposes admin endpoints to check", () => {
		const paths = adminEndpointPaths();
		expect(paths).toContain("/admin/list-users");
		expect(paths).toContain("/admin/impersonate-user");
		expect(paths).toContain("/admin/stop-impersonating");
		expect(paths.length).toBeGreaterThanOrEqual(15);
	});

	it("lists every admin endpoint path in disabledPaths", () => {
		const disabled = auth.options.disabledPaths ?? [];
		for (const path of adminEndpointPaths()) {
			expect(disabled, path).toContain(path);
		}
	});

	it("answers 404 to HTTP requests for admin endpoints", async () => {
		for (const path of adminEndpointPaths()) {
			const res = await auth.handler(
				new Request(`http://localhost:3000/api/auth${path}`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: "{}",
				}),
			);
			expect(res.status, path).toBe(404);
		}
	});

	it("keeps server-side auth.api admin calls working", () => {
		expect(auth.api.banUser).toBeTypeOf("function");
		expect(auth.api.impersonateUser).toBeTypeOf("function");
		expect(auth.api.stopImpersonating).toBeTypeOf("function");
	});
});

describe("other plugins' /admin/* endpoints", () => {
	function otherAdminEndpoints(): PluginEndpoint[] {
		return (auth.options.plugins ?? [])
			.filter((p) => p.id !== "admin")
			.flatMap((p) =>
				Object.values(
					(p as { endpoints?: Record<string, PluginEndpoint> }).endpoints ?? {},
				),
			)
			.filter(
				(endpoint) =>
					typeof endpoint.path === "string" &&
					endpoint.path.startsWith("/admin/"),
			);
	}

	it("keeps the JWT /token route disabled next to the admin paths", () => {
		expect(mcpOAuthActive).toBe(true);
		expect(auth.options.disabledPaths).toContain("/token");
	});

	it("exposes the OAuth provider's admin endpoints to check", () => {
		const paths = otherAdminEndpoints().map((endpoint) => endpoint.path);
		expect(paths.length).toBeGreaterThanOrEqual(8);
		expect(paths).toContain("/admin/oauth2/create-client");
		expect(paths).toContain("/admin/oauth2/update-client");
	});

	it("never serves them over HTTP (SERVER_ONLY, 404)", async () => {
		// Same request shape reaches a served route — the 404s below are real.
		const served = await auth.handler(
			new Request("http://localhost:3000/api/auth/oauth2/update-client", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "{}",
			}),
		);
		expect(served.status).not.toBe(404);
		for (const endpoint of otherAdminEndpoints()) {
			expect(endpoint.options?.metadata?.SERVER_ONLY, endpoint.path).toBe(true);
			const path = String(endpoint.path).replace(/:\w+/g, "x");
			const methods = [endpoint.options?.method ?? "POST"].flat();
			for (const method of methods) {
				const res = await auth.handler(
					new Request(`http://localhost:3000/api/auth${path}`, {
						method,
						headers: { "content-type": "application/json" },
						...(method === "GET" ? {} : { body: "{}" }),
					}),
				);
				expect(res.status, `${method} ${endpoint.path}`).toBe(404);
			}
		}
	});
});
