import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { BetterAuthOptions } from "better-auth";
import { describe, expect, it, vi } from "vitest";
import { assertSecondFactorForNewSession } from "../hooks/second-factor-session";

/**
 * The 2FA guard (hooks/second-factor-session.ts) refuses sessions on a
 * fixed list of paths — so it would fail open for an endpoint it does not
 * know. This test scans the installed Better Auth sources (core and every
 * plugin, incl. the ones the kit leaves off: a buyer may add oneTap,
 * emailOTP, genericOAuth, …) for endpoints that can mint a session and
 * fails on any path not classified below. A Better Auth upgrade that adds
 * one fails here until it is classified.
 *
 * "Mints a session": the endpoint body calls `createSession(` or a helper
 * whose module calls it outside an endpoint (handleOAuthUserInfo,
 * verifyTwoFactor, …) — an over-approximation, so some entries only
 * refresh or re-issue the caller's own session.
 */

/** Refused for a 2FA user (the guard must reject them). */
const GUARDED = [
	"/magic-link/verify",
	"/callback/:id",
	"/callback/:id/oauth-proxy",
	"/oauth2/callback/:providerId", // genericOAuth in older Better Auth
	"/sign-in/social",
	"/one-tap/callback",
	"/sign-in/email-otp",
	"/siwe/verify",
	"/phone-number/verify",
];

/** Allowed, with the reason it cannot skip the second factor. */
const ALLOWED: Record<string, string> = {
	"/sign-in/email": "password — the two-factor plugin withholds the session",
	"/sign-in/username": "password — the two-factor plugin withholds the session",
	"/sign-in/phone-number":
		"password — the two-factor plugin withholds the session",
	"/sign-up/email": "a new user, without 2FA",
	"/sign-in/anonymous": "a new anonymous user, without 2FA",
	"/two-factor/verify-totp": "the second factor itself",
	"/two-factor/verify-otp": "the second factor itself",
	"/two-factor/verify-backup-code": "the second factor itself",
	"/two-factor/send-otp": "sends the code; shares the verify helpers",
	"/two-factor/enable": "re-issues the caller's session (already signed in)",
	"/two-factor/disable": "re-issues the caller's session (already signed in)",
	"/passkey/verify-authentication":
		"a passkey is a second-factor-equivalent, device-bound credential",
	"/passkey/verify-registration":
		"signed in (fresh session, verified email); no new sign-in",
	"/change-password": "re-issues the caller's session (revokeOtherSessions)",
	"/link-social": "links a provider to the signed-in caller; no new sign-in",
	"/admin/impersonate-user":
		"closed over HTTP (disabledPaths); audited oRPC, admin-initiated",
	"/device/token": "the user approves the device in a signed-in session",
	"/verify-email":
		"signs in only with autoSignInAfterVerification (off, asserted below) or for a change-email token, which only a fresh, verified, signed-in session can request",
	"/email-otp/verify-email":
		"signs in only with autoSignInAfterVerification (off, asserted below)",
};

const require = createRequire(import.meta.url);
const distOf = (pkg: string) => {
	let dir = require.resolve(pkg);
	while (path.basename(dir) !== "dist") dir = path.dirname(dir);
	return dir;
};
const walk = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) return walk(full);
		return full.endsWith(".mjs") ? [full] : [];
	});

const sources = [
	"better-auth",
	"@better-auth/passkey",
	"@better-auth/mcp",
	"@better-auth/oauth-provider",
]
	.flatMap((pkg) => walk(distOf(pkg)))
	.filter((file) => !file.includes(`${path.sep}test-utils${path.sep}`))
	.map((file) => ({ file, text: readFileSync(file, "utf8") }));

/** Code before the first endpoint, and one block per endpoint. */
const split = (text: string) => {
	const starts = [...text.matchAll(/createAuthEndpoint\(/g)].map(
		(m) => m.index ?? 0,
	);
	return {
		rest: text.slice(0, starts[0] ?? text.length),
		blocks: starts.map((s, i) => text.slice(s, starts[i + 1] ?? text.length)),
	};
};

const escapeName = (name: string) => name.replace(/[$]/g, "\\$");

/** Session-minting functions: createSession and the helpers around it. */
function sessionMinters(): Set<string> {
	const minters = new Set(["createSession"]);
	const calls = (code: string) =>
		[...minters].some((m) => new RegExp(`\\b${escapeName(m)}\\(`).test(code));
	for (let grew = true; grew; ) {
		grew = false;
		for (const { text } of sources) {
			if (!calls(split(text).rest)) continue;
			for (const m of text.matchAll(/export \{([^}]*)\}/g)) {
				for (const part of (m[1] ?? "").split(",")) {
					for (const name of part.trim().split(/\s+as\s+/)) {
						if (name && !minters.has(name)) {
							minters.add(name);
							grew = true;
						}
					}
				}
			}
		}
	}
	return minters;
}

function sessionMintingPaths(): string[] {
	const minters = sessionMinters();
	const calls = (code: string) =>
		[...minters].some((m) => new RegExp(`\\b${escapeName(m)}\\(`).test(code));
	const paths = new Set<string>();
	for (const { file, text } of sources) {
		for (const block of split(text).blocks) {
			if (!calls(block)) continue;
			const literal = block.match(/^createAuthEndpoint\(\s*"([^"]+)"/);
			paths.add(literal?.[1] ?? `<non-literal path in ${path.basename(file)}>`);
		}
	}
	return [...paths].sort();
}

const guard = (p: string) =>
	assertSecondFactorForNewSession({
		path: p,
		userId: "user-1",
		findUser: vi.fn(async () => ({ twoFactorEnabled: true })),
		errorPageUrl: () => "http://localhost:3000/auth/error",
		redirect: (url) => Object.assign(new Error("redirect"), { url }),
	});

describe("2FA guard coverage of Better Auth's session-minting endpoints", () => {
	const found = sessionMintingPaths();

	it("finds the known ones (the scan works)", () => {
		expect(found).toEqual(
			expect.arrayContaining([
				"/magic-link/verify",
				"/callback/:id",
				"/sign-in/email",
				"/one-tap/callback",
			]),
		);
	});

	it("classifies every one of them", () => {
		const unclassified = found.filter(
			(p) => !GUARDED.includes(p) && !Object.hasOwn(ALLOWED, p),
		);
		expect(unclassified).toEqual([]);
	});

	it.each(GUARDED)("refuses a 2FA user's session on %s", async (p) => {
		await expect(guard(p)).rejects.toBeDefined();
	});

	it.each(Object.keys(ALLOWED))("lets %s through", async (p) => {
		await expect(guard(p)).resolves.toBeUndefined();
	});

	it("keeps autoSignInAfterVerification off (the /verify-email reason)", async () => {
		vi.resetModules();
		vi.doMock("@fuutu/env/saas", () => ({
			env: {
				BETTER_AUTH_URL: "http://localhost:3000",
				BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-12",
				NODE_ENV: "test",
				FUUTU_DISABLE_RATE_LIMIT: true,
			},
		}));
		vi.doMock("@fuutu/db/internal/client", () => ({ db: {} }));
		vi.doMock("@fuutu/payments", () => ({ createCustomerForUser: vi.fn() }));
		const { auth } = await import("../index");
		const verification: BetterAuthOptions["emailVerification"] =
			auth.options.emailVerification;
		expect(verification?.autoSignInAfterVerification).not.toBe(true);
	}, 30_000);
});
