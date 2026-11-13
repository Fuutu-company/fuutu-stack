import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/db", () => ({
	getOAuthConsentOwner: vi.fn(),
	revokeOAuthTokensForUser: vi.fn(),
}));

const { getOAuthConsentOwner, revokeOAuthTokensForUser } = await import(
	"@fuutu/db"
);
const {
	revokeOAuthTokensAfterAccountChange,
	revokeOAuthTokensBeforeConsentDelete,
} = await import("../hooks/mcp-oauth-revocation");

describe("revokeOAuthTokensAfterAccountChange", () => {
	beforeEach(() => {
		vi.mocked(revokeOAuthTokensForUser).mockReset();
		vi.mocked(revokeOAuthTokensForUser).mockResolvedValue({
			accessTokens: 0,
			refreshTokens: 1,
		});
	});

	it.each(["/change-password", "/revoke-sessions", "/revoke-other-sessions"])(
		"revokes every OAuth token of the user after a successful %s",
		async (path) => {
			await revokeOAuthTokensAfterAccountChange({
				path,
				returned: { status: true },
				userId: "user-1",
			});
			expect(revokeOAuthTokensForUser).toHaveBeenCalledWith("user-1");
		},
	);

	it("keeps tokens when the endpoint failed (e.g. wrong current password)", async () => {
		await revokeOAuthTokensAfterAccountChange({
			path: "/change-password",
			returned: new APIError("BAD_REQUEST", { message: "invalid password" }),
			userId: "user-1",
		});
		expect(revokeOAuthTokensForUser).not.toHaveBeenCalled();
	});

	it("ignores other endpoints and requests without a user", async () => {
		await revokeOAuthTokensAfterAccountChange({
			path: "/update-user",
			returned: { status: true },
			userId: "user-1",
		});
		await revokeOAuthTokensAfterAccountChange({
			path: "/revoke-sessions",
			returned: { status: true },
			userId: undefined,
		});
		expect(revokeOAuthTokensForUser).not.toHaveBeenCalled();
	});
});

describe("revokeOAuthTokensBeforeConsentDelete", () => {
	beforeEach(() => {
		vi.mocked(revokeOAuthTokensForUser).mockReset();
		vi.mocked(getOAuthConsentOwner).mockReset();
	});

	it("revokes the tokens of the consent's client for its owner", async () => {
		vi.mocked(getOAuthConsentOwner).mockResolvedValue({
			userId: "user-1",
			clientId: "client-1",
		});
		await revokeOAuthTokensBeforeConsentDelete({
			path: "/oauth2/delete-consent",
			body: { id: "consent-1" },
			userId: "user-1",
		});
		expect(getOAuthConsentOwner).toHaveBeenCalledWith("consent-1");
		expect(revokeOAuthTokensForUser).toHaveBeenCalledWith("user-1", "client-1");
	});

	it("does nothing for another user's consent (the provider rejects it)", async () => {
		vi.mocked(getOAuthConsentOwner).mockResolvedValue({
			userId: "someone-else",
			clientId: "client-1",
		});
		await revokeOAuthTokensBeforeConsentDelete({
			path: "/oauth2/delete-consent",
			body: { id: "consent-1" },
			userId: "user-1",
		});
		expect(revokeOAuthTokensForUser).not.toHaveBeenCalled();
	});

	it("does nothing without a session, id or for other paths", async () => {
		await revokeOAuthTokensBeforeConsentDelete({
			path: "/oauth2/delete-consent",
			body: { id: "consent-1" },
			userId: undefined,
		});
		await revokeOAuthTokensBeforeConsentDelete({
			path: "/oauth2/delete-consent",
			body: {},
			userId: "user-1",
		});
		await revokeOAuthTokensBeforeConsentDelete({
			path: "/oauth2/update-consent",
			body: { id: "consent-1" },
			userId: "user-1",
		});
		expect(getOAuthConsentOwner).not.toHaveBeenCalled();
		expect(revokeOAuthTokensForUser).not.toHaveBeenCalled();
	});
});
