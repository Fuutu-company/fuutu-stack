import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Desktop release routes: 404 while the module is off, the Tauri updater
 * contract (204 / JSON with a short-lived URL), auth `required` (token +
 * access), the licensed major, and installer downloads.
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
vi.mock("@fuutu/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@fuutu/storage", () => ({
	getObjectStream: vi.fn(),
	resolveStorageProvider: () => ({
		getSignedDownloadUrl: async ({ key }: { key: string }) =>
			`https://bucket.example.com/${key}?sig=1`,
	}),
}));
vi.mock("../modules/desktop/bearer", () => ({ resolveDesktopBearer: vi.fn() }));
vi.mock("../modules/desktop/access", () => ({
	resolveDesktopAccess: vi.fn(),
	resolveDesktopOrganization: vi.fn(),
}));
const rateLimit = vi.hoisted(() => ({ allowed: true }));
vi.mock("@fuutu/utils/rate-limit", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@fuutu/utils/rate-limit")>();
	return {
		...actual,
		defaultRateLimitStore: {
			...actual.defaultRateLimitStore,
			check: vi.fn(async () => ({
				allowed: rateLimit.allowed,
				remaining: 0,
				resetAt: Date.now() + 60_000,
			})),
		},
	};
});

const { auth } = await import("@fuutu/auth");
const { getObjectStream } = await import("@fuutu/storage");
const { resolveDesktopBearer } = await import("../modules/desktop/bearer");
const { resolveDesktopAccess, resolveDesktopOrganization } = await import(
	"../modules/desktop/access"
);
const { desktopConfig } = await import("@fuutu/desktop/config");
const { clearDesktopManifestCache, mountDesktopRoutes } = await import(
	"../modules/desktop/routes"
);

const app = new Hono().basePath("/api");
mountDesktopRoutes(app as never);

const MANIFEST = {
	version: "2.1.0",
	notes: "Faster sync",
	platforms: {
		"darwin-aarch64": {
			signature: "sig",
			url: "k",
			key: "stable/2.1.0/A.tar.gz",
		},
	},
	downloads: { macos: "stable/2.1.0/A.dmg" },
};

function serveManifest(manifest: unknown) {
	vi.mocked(getObjectStream).mockResolvedValue(
		manifest === null
			? null
			: ({ body: new Response(JSON.stringify(manifest)).body } as never),
	);
}

function grant(
	maxLicensedMajor: number | null,
	status = "granted",
	organizationId: string | null = null,
) {
	vi.mocked(resolveDesktopBearer).mockResolvedValue({
		user: { id: "u1", createdAt: new Date() },
		desktop: { clientId: "c", tokenId: "t", organizationId },
	} as never);
	vi.mocked(resolveDesktopAccess).mockResolvedValue({
		access: { status, trialEndsAt: null, maxLicensedMajor },
	} as never);
}

const update = (
	version = "2.0.0",
	headers: Record<string, string> = { authorization: "Bearer tok" },
) => app.request(`/api/desktop/updates/darwin/aarch64/${version}`, { headers });

beforeEach(() => {
	vi.clearAllMocks();
	clearDesktopManifestCache();
	flags.desktop = true;
	rateLimit.allowed = true;
	vi.mocked(resolveDesktopOrganization).mockResolvedValue(null);
	serveManifest(MANIFEST);
	grant(null);
});

describe("GET /api/desktop/updates/:target/:arch/:current_version", () => {
	it("is gone while the desktop module is off", async () => {
		flags.desktop = false;
		expect((await update()).status).toBe(404);
	});

	it("validates target, version and channel", async () => {
		expect(
			(await app.request("/api/desktop/updates/darwin/armv7/1.0.0")).status,
		).toBe(400);
		expect((await update("not-a-version")).status).toBe(400);
		expect(
			(
				await app.request(
					"/api/desktop/updates/darwin/aarch64/1.0.0?channel=nightly",
				)
			).status,
		).toBe(400);
	});

	it("needs the app's token while desktop auth is required", async () => {
		if (desktopConfig.auth !== "required") return;
		expect((await update("2.0.0", {})).status).toBe(401);
		vi.mocked(resolveDesktopBearer).mockResolvedValue(null);
		expect((await update()).status).toBe(401);
		grant(null, "missing");
		expect((await update()).status).toBe(403);
	});

	it("answers the Tauri updater contract with a short-lived URL", async () => {
		const res = await update();
		expect(res.status).toBe(200);
		expect(res.headers.get("cache-control")).toBe("no-store");
		expect(await res.json()).toEqual({
			version: "2.1.0",
			notes: "Faster sync",
			signature: "sig",
			url: "https://bucket.example.com/stable/2.1.0/A.tar.gz?sig=1",
		});
	});

	it("answers 204 when up to date, without a release, or above the licensed major", async () => {
		expect((await update("2.1.0")).status).toBe(204);
		grant(1);
		expect((await update("1.9.0")).status).toBe(204);
		clearDesktopManifestCache();
		serveManifest(null);
		grant(null);
		expect((await update()).status).toBe(204);
	});
});

describe("update route — org, major and rate limit", () => {
	it("uses the token's org only through the membership check", async () => {
		grant(null, "granted", "org-removed");
		// The user left the org: the resolver falls back to personal.
		vi.mocked(resolveDesktopOrganization).mockResolvedValue(null);
		await update();
		expect(resolveDesktopOrganization).toHaveBeenCalledWith(
			"u1",
			undefined,
			"org-removed",
		);
		expect(vi.mocked(resolveDesktopAccess).mock.calls[0]?.[0]).toMatchObject({
			organizationId: null,
		});
	});

	it("keeps an anonymous caller within its major", async () => {
		if (desktopConfig.auth === "required") return;
		if (!desktopConfig.access.perMajorVersion) return;
		serveManifest({ ...MANIFEST, version: "3.0.0" });
		expect((await update("2.0.0", {})).status).toBe(204);
	});

	it("429s a caller over the release limit", async () => {
		rateLimit.allowed = false;
		const res = await update();
		expect(res.status).toBe(429);
		expect(res.headers.get("retry-after")).toBeTruthy();
	});
});

describe("GET /api/desktop/download", () => {
	it("lists the current release's installers", async () => {
		const res = await app.request("/api/desktop/download");
		expect(await res.json()).toEqual({
			version: "2.1.0",
			platforms: ["macos"],
		});
		clearDesktopManifestCache();
		serveManifest(null);
		expect(await (await app.request("/api/desktop/download")).json()).toEqual({
			version: null,
			platforms: [],
		});
		flags.desktop = false;
		expect((await app.request("/api/desktop/download")).status).toBe(404);
	});
});

describe("GET /api/desktop/download/:platform", () => {
	it("redirects a signed-in browser to the installer", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue({
			user: { id: "u1" },
		} as never);
		const res = await app.request("/api/desktop/download/macos");
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe(
			"https://bucket.example.com/stable/2.1.0/A.dmg?sig=1",
		);
	});

	it("sends anonymous visitors to sign in while desktop auth is required", async () => {
		if (desktopConfig.auth !== "required") return;
		vi.mocked(auth.api.getSession).mockResolvedValue(null);
		const res = await app.request("/api/desktop/download/macos");
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toContain(
			"/auth/sign-in?redirect=%2Fsettings%2Fdesktop",
		);
	});

	it("404s unknown platforms, missing installers and a switched-off module", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue({
			user: { id: "u1" },
		} as never);
		expect((await app.request("/api/desktop/download/beos")).status).toBe(404);
		expect((await app.request("/api/desktop/download/linux")).status).toBe(404);
		flags.desktop = false;
		expect((await app.request("/api/desktop/download/macos")).status).toBe(404);
	});
});
