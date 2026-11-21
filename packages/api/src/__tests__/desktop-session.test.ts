import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";

/**
 * `desktop.session`: organization resolution (explicit switch, stale
 * sign-in org), API keys refused, offline claim only for the desktop app
 * and capped by the trial end.
 */

const flags = vi.hoisted(() => ({ desktop: true }));
vi.mock("@fuutu/config", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@fuutu/config")>();
	return {
		...actual,
		config: {
			...actual.config,
			features: new Proxy(actual.config.features, {
				get: (target, prop, receiver) =>
					prop in flags
						? flags[prop as keyof typeof flags]
						: Reflect.get(target, prop, receiver),
			}),
		},
	};
});
vi.mock("@fuutu/auth", () => ({ auth: { api: { signJWT: vi.fn() } } }));
vi.mock("@fuutu/auth/desktop-oauth", () => ({
	desktopOAuth: {
		active: true,
		clientId: "acme-desktop",
		issuer: "https://app.example.com",
		resource: "https://app.example.com/api/rpc",
	},
}));
vi.mock("@fuutu/db", () => ({
	countDesktopDevices: vi.fn(),
	getOrganizationWithMembers: vi.fn(),
	getUserById: vi.fn(),
	listOrganizationsForUser: vi.fn(),
}));
vi.mock("@fuutu/payments", () => ({ getUserEntitlement: vi.fn() }));
vi.mock("@fuutu/ai", () => ({ resolveAIProvider: vi.fn() }));

const { auth } = await import("@fuutu/auth");
const db = await import("@fuutu/db");
const { getUserEntitlement } = await import("@fuutu/payments");
const { desktopConfig } = await import("@fuutu/desktop/config");
const { desktopSessionProcedure } = await import(
	"../modules/desktop/procedures/session"
);

const USER = makeUser({ id: "u1" });
const ORG = { id: "org-1", name: "Acme", slug: "acme" };
/** An Ed25519 public key, base64url (43 chars). */
const INSTALL_KEY = "aW5zdGFsbC1rZXktb2YtdGhpcy1tYWNoaW5lLTAwMDA";

function ctx(extra: Partial<Context> = {}): Context {
	return { ...makeSession<Context>(USER), ...extra };
}
const desktop = (organizationId: string | null = null) =>
	ctx({
		apiKey: { id: "oauth:jti", organizationId: null },
		desktop: { clientId: "acme-desktop", tokenId: "jti", organizationId },
	} as Partial<Context>);

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(db.getUserById).mockResolvedValue({
		...USER,
		createdAt: new Date(),
	} as never);
	vi.mocked(db.listOrganizationsForUser).mockResolvedValue([ORG] as never);
	vi.mocked(db.countDesktopDevices).mockResolvedValue(1);
	vi.mocked(db.getOrganizationWithMembers).mockImplementation(((id: string) =>
		Promise.resolve(
			id === ORG.id
				? { ...ORG, members: [{ userId: "u1" }] }
				: { id, name: "Other", slug: "other", members: [{ userId: "x" }] },
		)) as never);
	vi.mocked(getUserEntitlement).mockResolvedValue({
		planId: "free",
		tier: "free",
		features: [],
	} as never);
	vi.mocked(auth.api.signJWT).mockResolvedValue({ token: "signed" } as never);
});

describe("desktop.session", () => {
	it("switches to a member organization and refuses a foreign one", async () => {
		const ok = await call(
			desktopSessionProcedure,
			{ organizationId: ORG.id },
			{ context: desktop() },
		);
		expect(ok.organization).toEqual(ORG);
		await expect(
			call(
				desktopSessionProcedure,
				{ organizationId: "org-x" },
				{ context: desktop() },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("falls back to personal when the sign-in org was left", async () => {
		const result = await call(
			desktopSessionProcedure,
			{},
			{ context: desktop("org-x") },
		);
		expect(result.organization).toBeNull();
	});

	it("refuses API keys, also org-pinned ones", async () => {
		await expect(
			call(
				desktopSessionProcedure,
				{ organizationId: ORG.id },
				{
					context: ctx({
						apiKey: { id: "k1", organizationId: ORG.id },
					} as Partial<Context>),
				},
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("signs an offline claim for the desktop app only, bound to its install key", async () => {
		const result = await call(
			desktopSessionProcedure,
			{ installKey: INSTALL_KEY },
			{ context: desktop() },
		);
		expect(result.offline?.token).toBe("signed");
		const payload = vi.mocked(auth.api.signJWT).mock.calls[0]?.[0]?.body
			?.payload as Record<string, unknown>;
		expect(payload).toMatchObject({
			sub: "u1",
			aud: "acme-desktop:offline",
			iss: "https://app.example.com",
			access: "granted",
			cnf: { jwk: { kty: "OKP", crv: "Ed25519", x: INSTALL_KEY } },
		});
		expect(Number(payload.exp) - Number(payload.iat)).toBe(
			desktopConfig.offlineGraceDays * 86_400,
		);

		vi.mocked(auth.api.signJWT).mockClear();
		const browser = await call(
			desktopSessionProcedure,
			{ installKey: INSTALL_KEY },
			{ context: ctx() },
		);
		expect(browser.offline).toBeNull();
		expect(auth.api.signJWT).not.toHaveBeenCalled();
	});

	it("issues no offline claim without an install key, and refuses a malformed one", async () => {
		const unbound = await call(
			desktopSessionProcedure,
			{},
			{ context: desktop() },
		);
		expect(unbound.offline).toBeNull();
		expect(auth.api.signJWT).not.toHaveBeenCalled();
		await expect(
			call(
				desktopSessionProcedure,
				{ installKey: "not a key" },
				{ context: desktop() },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("reports the device limit", async () => {
		vi.mocked(db.countDesktopDevices).mockResolvedValue(99);
		const result = await call(
			desktopSessionProcedure,
			{},
			{ context: desktop() },
		);
		if (desktopConfig.devices.limit === null) {
			expect(result.access.status).toBe("granted");
		} else {
			expect(result.access.status).toBe("device_limit");
			expect(result.offline).toBeNull();
		}
	});
});
