import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/db", () => ({
	getOAuthClientSummary: vi.fn(),
	isUnverifiedOAuthClient: (c: {
		userId: string | null;
		referenceId: string | null;
		skipConsent: boolean | null;
	}) => !c.userId && !c.referenceId && c.skipConsent !== true,
}));

const { getOAuthClientSummary } = await import("@fuutu/db");
const {
	assertRegistrationWithinLimits,
	getAuthorizeParams,
	getPromptNoneBlockUrl,
	getUnverifiedErrorRedirect,
} = await import("../hooks/mcp-oauth-guards");

const APP_ORIGIN = "https://app.example.com";
const ERROR_PAGE = "https://app.example.com/api/auth/error";
const CALLBACK = "http://127.0.0.1:33418/callback";

const UNVERIFIED = {
	clientId: "c-dyn",
	name: "Evil",
	uri: null,
	icon: null,
	userId: null,
	referenceId: null,
	skipConsent: null,
	disabled: false,
};
const OWNED = { ...UNVERIFIED, clientId: "c-owned", userId: "user-1" };

function expectBadRequest(fn: () => void, error: string) {
	try {
		fn();
	} catch (err) {
		expect(err).toBeInstanceOf(APIError);
		expect((err as APIError).statusCode).toBe(400);
		expect((err as APIError).body).toMatchObject({ error });
		return;
	}
	throw new Error("expected a 400 APIError");
}

describe("assertRegistrationWithinLimits", () => {
	const valid = {
		client_name: "Claude Code",
		redirect_uris: [CALLBACK],
		token_endpoint_auth_method: "none",
	};

	it("accepts a typical MCP client registration", () => {
		expect(() =>
			assertRegistrationWithinLimits(
				valid,
				String(JSON.stringify(valid).length),
			),
		).not.toThrow();
	});

	it("rejects a client_name over 100 characters", () => {
		expectBadRequest(
			() =>
				assertRegistrationWithinLimits(
					{ ...valid, client_name: "x".repeat(101) },
					null,
				),
			"invalid_client_metadata",
		);
	});

	it("accepts a client_name of exactly 100 characters", () => {
		expect(() =>
			assertRegistrationWithinLimits(
				{ ...valid, client_name: "x".repeat(100) },
				null,
			),
		).not.toThrow();
	});

	it("rejects more than 5 redirect_uris", () => {
		expectBadRequest(
			() =>
				assertRegistrationWithinLimits(
					{
						...valid,
						redirect_uris: Array.from(
							{ length: 6 },
							(_, i) => `http://127.0.0.1/${i}`,
						),
					},
					null,
				),
			"invalid_redirect_uri",
		);
	});

	it("rejects a redirect_uri longer than 2048 characters", () => {
		expectBadRequest(
			() =>
				assertRegistrationWithinLimits(
					{
						...valid,
						redirect_uris: [`http://127.0.0.1/${"a".repeat(2048)}`],
					},
					null,
				),
			"invalid_redirect_uri",
		);
	});

	it("rejects a body larger than 16 KB", () => {
		expectBadRequest(
			() =>
				assertRegistrationWithinLimits(
					{ ...valid, software_statement: "s".repeat(17 * 1024) },
					null,
				),
			"invalid_client_metadata",
		);
	});

	it("rejects a declared Content-Length larger than 16 KB", () => {
		expectBadRequest(
			() => assertRegistrationWithinLimits(valid, String(16 * 1024 + 1)),
			"invalid_client_metadata",
		);
	});
});

describe("getAuthorizeParams", () => {
	it("reads the query of a GET authorize request", () => {
		expect(getAuthorizeParams({ client_id: "c1" }, undefined)).toEqual({
			client_id: "c1",
		});
	});

	it("reads a form-POSTed authorize body when the query has no client_id", () => {
		expect(getAuthorizeParams({}, { client_id: "c1" })).toEqual({
			client_id: "c1",
		});
	});

	it("prefers the query when authorize is resumed after sign-in", () => {
		expect(
			getAuthorizeParams(
				{ client_id: "c1" },
				{ email: "a@b.c", password: "secret" },
			),
		).toEqual({ client_id: "c1" });
	});
});

describe("getPromptNoneBlockUrl", () => {
	beforeEach(() => {
		vi.mocked(getOAuthClientSummary).mockReset();
	});

	it("sends prompt=none of an unverified client to the app error page", async () => {
		vi.mocked(getOAuthClientSummary).mockResolvedValue(UNVERIFIED);
		const url = await getPromptNoneBlockUrl(
			{ client_id: "c-dyn", prompt: "none", redirect_uri: CALLBACK },
			ERROR_PAGE,
		);
		expect(url).not.toBeNull();
		const parsed = new URL(url ?? "");
		expect(`${parsed.origin}${parsed.pathname}`).toBe(ERROR_PAGE);
		expect(parsed.searchParams.get("error")).toBe("interaction_required");
		expect(getOAuthClientSummary).toHaveBeenCalledWith("c-dyn");
	});

	it("also catches none inside a multi-value prompt", async () => {
		vi.mocked(getOAuthClientSummary).mockResolvedValue(UNVERIFIED);
		expect(
			await getPromptNoneBlockUrl(
				{ client_id: "c-dyn", prompt: "login none" },
				ERROR_PAGE,
			),
		).not.toBeNull();
	});

	it("leaves prompt=none of an owned client to the provider", async () => {
		vi.mocked(getOAuthClientSummary).mockResolvedValue(OWNED);
		expect(
			await getPromptNoneBlockUrl(
				{ client_id: "c-owned", prompt: "none" },
				ERROR_PAGE,
			),
		).toBeNull();
	});

	it("ignores interactive prompts without a lookup", async () => {
		expect(
			await getPromptNoneBlockUrl(
				{ client_id: "c-dyn", prompt: "consent" },
				ERROR_PAGE,
			),
		).toBeNull();
		expect(
			await getPromptNoneBlockUrl({ client_id: "c-dyn" }, ERROR_PAGE),
		).toBeNull();
		expect(getOAuthClientSummary).not.toHaveBeenCalled();
	});

	it("leaves unknown clients to the provider (it renders its own error page)", async () => {
		vi.mocked(getOAuthClientSummary).mockResolvedValue(null);
		expect(
			await getPromptNoneBlockUrl(
				{ client_id: "nope", prompt: "none" },
				ERROR_PAGE,
			),
		).toBeNull();
	});
});

describe("getUnverifiedErrorRedirect", () => {
	beforeEach(() => {
		vi.mocked(getOAuthClientSummary).mockReset();
		vi.mocked(getOAuthClientSummary).mockResolvedValue(UNVERIFIED);
	});

	const redirectError = (location: string) =>
		new APIError("FOUND", undefined, new Headers({ location }));

	const run = (returned: unknown, clientId = "c-dyn") =>
		getUnverifiedErrorRedirect({
			returned,
			params: { client_id: clientId },
			appOrigin: APP_ORIGIN,
			errorPageUrl: ERROR_PAGE,
		});

	it("rewrites an error redirect to an unverified client's redirect_uri", async () => {
		const result = await run(
			redirectError(
				`${CALLBACK}?error=invalid_scope&error_description=bad+scope&state=s`,
			),
		);
		expect(result?.mode).toBe("redirect");
		const parsed = new URL(result?.url ?? "");
		expect(`${parsed.origin}${parsed.pathname}`).toBe(ERROR_PAGE);
		expect(parsed.searchParams.get("error")).toBe("invalid_scope");
		expect(parsed.searchParams.get("error_description")).toBe("bad scope");
		expect(parsed.searchParams.get("state")).toBeNull();
	});

	it("rewrites a redirect from ctx.redirect (better-call's base APIError, not the better-auth subclass)", async () => {
		// `ctx.redirect()` constructs better-call's own APIError — an
		// `instanceof` check against better-auth's subclass misses it.
		const thrown = Object.assign(new Error(), {
			name: "APIError",
			status: "FOUND",
			statusCode: 302,
			headers: new Headers({
				location: `${CALLBACK}?error=invalid_scope&error_description=x`,
			}),
		});
		expect(thrown).not.toBeInstanceOf(APIError);
		const result = await run(thrown);
		expect(result?.mode).toBe("redirect");
		expect(result?.url.startsWith(ERROR_PAGE)).toBe(true);
	});

	it("rewrites the JSON redirect form used by fetch callers", async () => {
		const result = await run({
			redirect: true,
			url: `${CALLBACK}?error=login_required&error_description=x`,
		});
		expect(result?.mode).toBe("json");
		expect(result?.url.startsWith(ERROR_PAGE)).toBe(true);
	});

	it("rewrites errors delivered in the fragment", async () => {
		const result = await run(
			redirectError("https://evil.example.com/cb#error=access_denied"),
		);
		expect(result?.url.startsWith(ERROR_PAGE)).toBe(true);
	});

	it("keeps successful code redirects", async () => {
		expect(await run(redirectError(`${CALLBACK}?code=abc&state=s`))).toBeNull();
	});

	it("keeps redirects within the app (login, consent, own error page)", async () => {
		expect(
			await run(redirectError("/auth/consent?client_id=c-dyn&sig=x")),
		).toBeNull();
		expect(
			await run(redirectError(`${ERROR_PAGE}?error=invalid_client`)),
		).toBeNull();
		expect(getOAuthClientSummary).not.toHaveBeenCalled();
	});

	it("keeps error redirects of owned clients (RFC 6749 behavior)", async () => {
		vi.mocked(getOAuthClientSummary).mockResolvedValue(OWNED);
		expect(
			await run(redirectError(`${CALLBACK}?error=invalid_scope`), "c-owned"),
		).toBeNull();
	});

	it("ignores non-redirect results", async () => {
		expect(await run(new APIError("BAD_REQUEST", { error: "x" }))).toBeNull();
		expect(await run({ status: true })).toBeNull();
		expect(await run(undefined)).toBeNull();
	});

	it("ignores requests without a client_id", async () => {
		expect(
			await getUnverifiedErrorRedirect({
				returned: redirectError(`${CALLBACK}?error=invalid_request`),
				params: {},
				appOrigin: APP_ORIGIN,
				errorPageUrl: ERROR_PAGE,
			}),
		).toBeNull();
	});
});
