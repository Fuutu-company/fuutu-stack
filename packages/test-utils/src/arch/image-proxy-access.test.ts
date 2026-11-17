import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/image-proxy` authorizes every object, not just the session: another
 * user's or another org's object is a 404 (no existence oracle) and is
 * never fetched from storage. Calls the route's GET with a mocked session,
 * org membership and storage.
 */

const mocks = vi.hoisted(() => ({
	session: null as null | { user: { id: string; role: string } },
	getOrganizationMemberRole: vi.fn(),
	getObjectStream: vi.fn(),
}));

vi.mock("@/lib/auth-server", () => ({
	getSession: vi.fn(async () => mocks.session),
}));
// By file: the route resolves these workspace packages from apps/saas.
vi.mock("../../../db/index.ts", () => ({
	getOrganizationMemberRole: mocks.getOrganizationMemberRole,
}));
// Empty env: storage resolves its default bucket names and read access.
vi.mock("../../../env/src/saas.ts", () => ({ env: {} }));
vi.mock("../../../storage/src/index.ts", async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	getObjectStream: mocks.getObjectStream,
}));
// Procedure middleware next to `memberHasOrgPermission`; the read path
// never calls it, and it would load the whole auth module.
vi.mock("../../../api/src/orpc/middleware/authorize.ts", () => ({}));
vi.mock("../../../logs/src/next.ts", () => ({
	createEvlog: () => ({ withEvlog: <T>(handler: T) => handler }),
}));

// Through a variable: the route's `@/` imports only resolve inside the
// saas app, so this package's type-check must not follow it.
const ROUTE = join(
	import.meta.dirname,
	"../../../../apps/saas/src/app/image-proxy/[...path]/route.ts",
);
const { GET } = (await import(/* @vite-ignore */ ROUTE)) as {
	GET: (
		req: Request,
		ctx: { params: Promise<{ path: string[] }> },
	) => Promise<Response>;
};

const get = (path: string[]) =>
	GET(new Request(`http://localhost/image-proxy/${path.join("/")}`), {
		params: Promise.resolve({ path }),
	});

beforeEach(() => {
	vi.clearAllMocks();
	mocks.session = { user: { id: "user-1", role: "user" } };
	mocks.getOrganizationMemberRole.mockResolvedValue(null);
	mocks.getObjectStream.mockResolvedValue({
		body: "png-bytes",
		contentType: "image/png",
	});
});

describe("image-proxy per-object access", () => {
	it("answers 401 without a session", async () => {
		mocks.session = null;
		const res = await get(["organization-logos", "user-1", "logo.png"]);
		expect(res.status).toBe(401);
		expect(mocks.getObjectStream).not.toHaveBeenCalled();
	});

	it("serves the viewer's own object", async () => {
		const res = await get(["organization-logos", "user-1", "logo.png"]);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("png-bytes");
	});

	it("answers another user's object with 404 and never fetches it", async () => {
		const res = await get(["organization-logos", "user-2", "logo.png"]);
		expect(res.status).toBe(404);
		expect(mocks.getObjectStream).not.toHaveBeenCalled();
	});

	it("serves an org's object to a member with STORAGE.VIEW", async () => {
		mocks.getOrganizationMemberRole.mockResolvedValue("member");
		const res = await get(["organization-logos", "org-1", "logo.png"]);
		expect(res.status).toBe(200);
		expect(mocks.getOrganizationMemberRole).toHaveBeenCalledWith(
			"org-1",
			"user-1",
		);
	});

	it("answers an org's object with 404 to a non-member", async () => {
		const res = await get(["organization-logos", "org-1", "logo.png"]);
		expect(res.status).toBe(404);
		expect(mocks.getObjectStream).not.toHaveBeenCalled();
	});
});
