import { createRequire } from "node:module";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The SaaS proxy's public paths (`apps/saas/src/proxy.ts`): a signed-out
 * request to a public path passes, anything else goes to sign-in. Single
 * files are public as `{ exact }` — a prefix would also open every path
 * that merely starts with the same characters.
 */

const SAAS = join(import.meta.dirname, "../../../../apps/saas");
const resolveFromApp = createRequire(join(SAAS, "package.json")).resolve;

type ProxyModule = {
	proxy: (req: unknown) => Promise<Response>;
};
type NextRequestCtor = new (url: string) => unknown;

let proxy: ProxyModule["proxy"];
let NextRequest: NextRequestCtor;

beforeAll(async () => {
	vi.doMock(resolveFromApp("@fuutu/env/saas"), () => ({
		env: { FUUTU_AUTH_COOKIE_PREFIX: "better-auth" },
	}));
	vi.doMock(resolveFromApp("@fuutu/auth/session-cookie"), () => ({
		hasSessionCookie: () => false,
		hasApiKeyCredential: () => false,
		hasDesktopBearer: () => false,
	}));
	({ NextRequest } = (await import(
		/* @vite-ignore */ resolveFromApp("next/server")
	)) as { NextRequest: NextRequestCtor });
	({ proxy } = (await import(
		/* @vite-ignore */ join(SAAS, "src/proxy.ts")
	)) as ProxyModule);
}, 30_000);

/** Where a signed-out request ends up: "pass" or the redirect target path. */
async function signedOut(path: string): Promise<string> {
	const res = await proxy(new NextRequest(`http://localhost${path}`));
	const location = res.headers.get("location");
	return location ? new URL(location).pathname : "pass";
}

describe("saas proxy public paths (signed out)", () => {
	it("serves robots.txt without a session", async () => {
		expect(await signedOut("/robots.txt")).toBe("pass");
	});

	it("does not open paths that only start like robots.txt", async () => {
		expect(await signedOut("/robots.txt.bak")).toBe("/auth/sign-in");
		expect(await signedOut("/robots.txt/admin")).toBe("/auth/sign-in");
	});

	it("still sends other app routes to sign-in", async () => {
		expect(await signedOut("/dashboard")).toBe("/auth/sign-in");
	});
});
