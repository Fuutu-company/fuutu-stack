import { makeSignature } from "better-auth/crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/db", () => ({
	getOAuthClientSummary: vi.fn(),
	getOrganizationById: vi.fn(),
	isUnverifiedOAuthClient: (c: {
		userId: string | null;
		referenceId: string | null;
		skipConsent: boolean | null;
	}) => !c.userId && !c.referenceId && c.skipConsent !== true,
}));

const { getOAuthClientSummary, getOrganizationById } = await import(
	"@fuutu/db"
);
const { resolveMcpConsentRequest } = await import("../mcp-consent");

const SECRET = "test-secret-at-least-32-characters-long";

/** Signs like the provider's `signParams` (sorted params, HMAC, `sig`). */
async function signedQuery(
	params: Record<string, string>,
	{ expiresIn = 600 } = {},
): Promise<Record<string, string | string[]>> {
	const query = new URLSearchParams({
		...params,
		exp: String(Math.floor(Date.now() / 1000) + expiresIn),
	});
	const names = [...new Set([...query.keys(), "ba_param"])].sort();
	for (const name of names) query.append("ba_param", name);
	const canonical = new URLSearchParams(
		[...query.entries()].sort(([a, av], [b, bv]) =>
			a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0,
		),
	);
	query.set("sig", await makeSignature(canonical.toString(), SECRET));
	const out: Record<string, string | string[]> = {};
	for (const key of new Set(query.keys())) {
		const values = query.getAll(key);
		out[key] = values.length > 1 ? values : (values[0] ?? "");
	}
	return out;
}

const CLIENT = {
	clientId: "c-dyn",
	name: "Claude Code",
	uri: "https://claude.ai/about",
	icon: null,
	userId: null,
	referenceId: null,
	skipConsent: null,
	disabled: false,
};

const BASE = {
	client_id: "c-dyn",
	redirect_uri: "http://127.0.0.1:33418/callback",
	scope: "openid profile offline_access",
	response_type: "code",
};

describe("resolveMcpConsentRequest", () => {
	beforeEach(() => {
		vi.mocked(getOAuthClientSummary).mockReset();
		vi.mocked(getOAuthClientSummary).mockResolvedValue(CLIENT);
		vi.mocked(getOrganizationById).mockReset();
		vi.mocked(getOrganizationById).mockResolvedValue({
			id: "org-1",
			name: "Acme",
		} as never);
	});

	it("shows redirect host, client URI host, unverified label, org and scopes", async () => {
		const result = await resolveMcpConsentRequest(await signedQuery(BASE), {
			activeOrganizationId: "org-1",
			secret: SECRET,
		});
		expect(result).toEqual({
			clientName: "Claude Code",
			clientHost: "claude.ai",
			redirectHost: "127.0.0.1:33418",
			unverified: true,
			organizationName: "Acme",
			scopes: ["openid", "profile", "offline_access"],
		});
		expect(getOAuthClientSummary).toHaveBeenCalledWith("c-dyn");
		expect(getOrganizationById).toHaveBeenCalledWith("org-1");
	});

	it("rejects a tampered redirect_uri (signature mismatch)", async () => {
		const query = await signedQuery(BASE);
		query.redirect_uri = "https://trusted.example.com/callback";
		expect(
			await resolveMcpConsentRequest(query, {
				activeOrganizationId: "org-1",
				secret: SECRET,
			}),
		).toBeNull();
		expect(getOAuthClientSummary).not.toHaveBeenCalled();
	});

	it("rejects an expired request", async () => {
		expect(
			await resolveMcpConsentRequest(
				await signedQuery(BASE, { expiresIn: -10 }),
				{ activeOrganizationId: null, secret: SECRET },
			),
		).toBeNull();
	});

	it("rejects an unsigned request", async () => {
		expect(
			await resolveMcpConsentRequest(BASE, {
				activeOrganizationId: null,
				secret: SECRET,
			}),
		).toBeNull();
	});

	it("rejects unknown and disabled clients", async () => {
		vi.mocked(getOAuthClientSummary).mockResolvedValue(null);
		expect(
			await resolveMcpConsentRequest(await signedQuery(BASE), {
				activeOrganizationId: null,
				secret: SECRET,
			}),
		).toBeNull();
		vi.mocked(getOAuthClientSummary).mockResolvedValue({
			...CLIENT,
			disabled: true,
		});
		expect(
			await resolveMcpConsentRequest(await signedQuery(BASE), {
				activeOrganizationId: null,
				secret: SECRET,
			}),
		).toBeNull();
	});

	it("marks owned clients as verified and has no org without an active one", async () => {
		vi.mocked(getOAuthClientSummary).mockResolvedValue({
			...CLIENT,
			userId: "owner-1",
		});
		expect(
			await resolveMcpConsentRequest(await signedQuery(BASE), {
				activeOrganizationId: null,
				secret: SECRET,
			}),
		).toMatchObject({ unverified: false, organizationName: null });
		expect(getOrganizationById).not.toHaveBeenCalled();
	});

	it("never shows a non-http client_uri (javascript:, data:)", async () => {
		vi.mocked(getOAuthClientSummary).mockResolvedValue({
			...CLIENT,
			uri: "javascript:alert(1)",
		});
		expect(
			await resolveMcpConsentRequest(await signedQuery(BASE), {
				activeOrganizationId: null,
				secret: SECRET,
			}),
		).toMatchObject({ clientHost: null });
	});

	it("shows the scheme for custom-scheme redirect URIs without a host", async () => {
		expect(
			await resolveMcpConsentRequest(
				await signedQuery({ ...BASE, redirect_uri: "com.example.app:/cb" }),
				{ activeOrganizationId: null, secret: SECRET },
			),
		).toMatchObject({ redirectHost: "com.example.app:" });
	});
});
