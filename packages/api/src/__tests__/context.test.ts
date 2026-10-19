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
	verifyApiKeyWithOwner: vi.fn(),
}));

const { auth } = await import("@fuutu/auth");
const { verifyApiKeyWithOwner } = await import("@fuutu/db");
const { createContext } = await import("../context");

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
			apiKey: { id: "key-1", organizationId: null },
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
			apiKey: { id: "key-1", organizationId: null },
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
			apiKey: { id: "key-2", organizationId: "org-7" },
			user: { id: "user-9", banned: false },
		} as never);

		const ctx = await createContext({
			context: fakeHonoContext(new Headers({ "x-api-key": "futu_sk_org" })),
		});

		expect(ctx.apiKey).toEqual({ id: "key-2", organizationId: "org-7" });
	});
});
