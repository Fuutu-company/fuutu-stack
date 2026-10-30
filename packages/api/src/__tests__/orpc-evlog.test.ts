import { afterEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";
import { publicProcedure } from "../orpc/procedures";

// Keep the real publicProcedure (it carries the evlog() middleware) but
// back the handler with a trivial probe router — importing the production
// router would pull every feature module (@fuutu/db, @fuutu/auth, …).
const probeRouter = publicProcedure.router({
	probe: publicProcedure.handler(() => ({ ok: true })),
});

vi.mock("../orpc/router", () => ({ router: probeRouter }));
vi.mock("../orpc/openapi-merge", () => ({
	getBetterAuthSpecPaths: vi.fn(async () => ({})),
}));
vi.mock("@fuutu/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@fuutu/db", () => ({ verifyApiKeyWithOwner: vi.fn() }));

const { rpcHandler } = await import("../orpc/handler");

const anonymousContext: Context = {
	session: null,
	headers: new Headers(),
	apiKey: null,
};

describe("rpcHandler evlog wiring", () => {
	afterEach(() => vi.restoreAllMocks());

	it("emits one wide event per RPC request with the procedure as operation", async () => {
		// The exported rpcHandler must be wrapped in withEvlog — under vitest
		// evlog emits the wide event through console.*, which we capture here.
		const lines: string[] = [];
		for (const method of ["log", "info", "warn", "error"] as const) {
			vi.spyOn(console, method).mockImplementation((...args) => {
				lines.push(args.map(String).join(" "));
			});
		}

		const { matched, response } = await rpcHandler.handle(
			new Request("http://localhost/api/rpc/probe", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-request-id": "req-test-1",
				},
				body: JSON.stringify({ json: {} }),
			}),
			{ prefix: "/api/rpc", context: { ...anonymousContext } },
		);

		expect(matched).toBe(true);
		expect(response?.status).toBe(200);

		// Wide event emitted by withEvlog; `operation` is set by the evlog()
		// middleware on publicProcedure, `requestId` flows from the header.
		// Assertions are format-agnostic (pretty in dev, JSON in prod).
		const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
		const plain = lines.join("\n").replace(ANSI_RE, "");
		expect(plain).toMatch(/operation[":\s]+probe/);
		expect(plain).toContain("/api/rpc/probe");
		expect(plain).toContain("POST");
		expect(plain).toMatch(/requestId[":\s]+req-test-1/);
	});
});
