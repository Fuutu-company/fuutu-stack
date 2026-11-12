import type { Context as HonoContext } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn(),
		},
	},
}));

vi.mock("@fuutu/db", () => ({
	API_KEY_PREFIX: "futu_sk_",
	verifyApiKeyWithOwner: vi.fn(),
}));

const { auth } = await import("@fuutu/auth");
const { verifyApiKeyWithOwner } = await import("@fuutu/db");
const { createContext } = await import("../context");
const { protectedProcedure } = await import("../orpc/procedures");
const { call, ORPCError } = await import("@orpc/server");

// `createContext` only reads `context.req.raw.headers`, so a minimal
// structural fake is enough — the cast adapts it to HonoContext.
const fakeHonoContext = (headers: Headers) =>
	({ req: { raw: { headers } } }) as unknown as HonoContext;

describe("createContext — x-api-key path", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("ignores the api-key header when a session is present", async () => {
		const session = {
			user: { id: "user-1", banned: false },
			session: { id: "sess-1" },
		};
		vi.mocked(auth.api.getSession).mockResolvedValue(session as never);

		const ctx = await createContext({
			context: fakeHonoContext(new Headers({ "x-api-key": "futu_sk_ignored" })),
		});

		expect(verifyApiKeyWithOwner).not.toHaveBeenCalled();
		expect(ctx.apiKey).toBeNull();
		expect(ctx.session).toBe(session);
	});

	it("builds a {user} session and apiKey context for a valid key", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue(null);
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue({
			apiKey: { id: "key-1", organizationId: null, scopes: [] },
			user: { id: "user-9", email: "u@example.com", banned: false },
		} as never);

		const ctx = await createContext({
			context: fakeHonoContext(new Headers({ "x-api-key": "futu_sk_valid" })),
		});

		expect(verifyApiKeyWithOwner).toHaveBeenCalledWith("futu_sk_valid");
		expect(ctx.apiKey).toEqual({ id: "key-1", organizationId: null });
		expect(ctx.session?.user.id).toBe("user-9");
	});

	it("rejects keys whose owner is banned", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue(null);
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue({
			apiKey: { id: "key-1", organizationId: null, scopes: [] },
			user: { id: "user-9", banned: true },
		} as never);

		const ctx = await createContext({
			context: fakeHonoContext(new Headers({ "x-api-key": "futu_sk_banned" })),
		});

		expect(ctx.session).toBeNull();
		expect(ctx.apiKey).toBeNull();
	});

	it("yields null session and apiKey when the key does not verify", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue(null);
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue(null);

		const ctx = await createContext({
			context: fakeHonoContext(new Headers({ "x-api-key": "futu_sk_bad" })),
		});

		expect(ctx.session).toBeNull();
		expect(ctx.apiKey).toBeNull();
	});

	it("carries organizationId for org-scoped keys", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue(null);
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue({
			apiKey: { id: "key-2", organizationId: "org-7", scopes: [] },
			user: { id: "user-9", banned: false },
		} as never);

		const ctx = await createContext({
			context: fakeHonoContext(new Headers({ "x-api-key": "futu_sk_org" })),
		});

		expect(ctx.apiKey).toEqual({ id: "key-2", organizationId: "org-7" });
	});
});

// A trivial protected procedure — enough to prove whether the context
// built from a credential authenticates on the oRPC surface.
const whoami = protectedProcedure.handler(({ context }) => context.user.id);

const verifiedKey = (scopes: string[]) => ({
	apiKey: { id: "key-s", organizationId: null, scopes },
	user: { id: "user-9", email: "u@example.com", banned: false },
});

async function callWithHeaders(headers: Headers) {
	const context = await createContext({ context: fakeHonoContext(headers) });
	return call(whoami, undefined, { context });
}

describe("createContext — API-key scopes on the oRPC surface", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(auth.api.getSession).mockResolvedValue(null);
	});

	it.each([[["mcp"]], [["versioning"]], [["mcp", "versioning"]]])(
		"rejects a key scoped to %j with UNAUTHORIZED",
		async (scopes) => {
			vi.mocked(verifyApiKeyWithOwner).mockResolvedValue(
				verifiedKey(scopes) as never,
			);

			const err = await callWithHeaders(
				new Headers({ "x-api-key": "futu_sk_scoped" }),
			).catch((e: unknown) => e);

			expect(err).toBeInstanceOf(ORPCError);
			expect((err as InstanceType<typeof ORPCError>).code).toBe("UNAUTHORIZED");
		},
	);

	it("does not authenticate a scoped key without the api scope", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue(
			verifiedKey(["mcp"]) as never,
		);

		const ctx = await createContext({
			context: fakeHonoContext(new Headers({ "x-api-key": "futu_sk_mcp" })),
		});

		expect(ctx.session).toBeNull();
		expect(ctx.apiKey).toBeNull();
	});

	it("accepts a key carrying the api scope", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue(
			verifiedKey(["mcp", "api"]) as never,
		);

		await expect(
			callWithHeaders(new Headers({ "x-api-key": "futu_sk_api" })),
		).resolves.toBe("user-9");
	});

	it("accepts an unscoped key (full credential)", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue(
			verifiedKey([]) as never,
		);

		await expect(
			callWithHeaders(new Headers({ "x-api-key": "futu_sk_full" })),
		).resolves.toBe("user-9");
	});

	it("accepts a futu_sk_ key as Authorization: Bearer", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue(
			verifiedKey([]) as never,
		);

		await expect(
			callWithHeaders(new Headers({ authorization: "Bearer futu_sk_bearer" })),
		).resolves.toBe("user-9");
		expect(verifyApiKeyWithOwner).toHaveBeenCalledWith("futu_sk_bearer");
	});

	it("enforces scopes on bearer keys too", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue(
			verifiedKey(["mcp"]) as never,
		);

		await expect(
			callWithHeaders(new Headers({ authorization: "Bearer futu_sk_mcp" })),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("ignores non-API-key bearer tokens", async () => {
		const ctx = await createContext({
			context: fakeHonoContext(
				new Headers({ authorization: "Bearer some-oauth-token" }),
			),
		});

		expect(verifyApiKeyWithOwner).not.toHaveBeenCalled();
		expect(ctx.session).toBeNull();
	});
});
