import {
	existsSync,
	readdirSync,
	readFileSync,
	realpathSync,
	statSync,
} from "node:fs";
import path from "node:path";
import type { BetterAuthOptions } from "better-auth";
import { describe, expect, it, vi } from "vitest";
import { assertSecondFactorForNewSession } from "../hooks/second-factor-session";

/**
 * The 2FA guard (hooks/second-factor-session.ts) refuses sessions on a
 * fixed list of paths — so it would fail open for an endpoint it does not
 * know. This test scans the installed Better Auth sources (better-auth
 * with every plugin, incl. the ones the kit leaves off: a buyer may add
 * oneTap, emailOTP, genericOAuth, …, plus every `@better-auth/*` package
 * installed for @fuutu/auth, e.g. a buyer's `@better-auth/sso`) for
 * endpoints that can mint a session and fails on any path not classified
 * below. A Better Auth upgrade or a new plugin package that adds one
 * fails here until it is classified.
 *
 * "Mints a session": the endpoint body calls `createSession(` or a
 * module-level function that does, transitively and wherever it sits in
 * its file (handleOAuthUserInfo, verifyTwoFactor, …) — an
 * over-approximation, so some entries only refresh or re-issue the
 * caller's own session.
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

/**
 * better-auth plus every `@better-auth/*` package installed for this
 * package (a buyer's `@better-auth/sso` included) — listed, not hard-coded.
 */
const nodeModules = path.join(import.meta.dirname, "../../node_modules");
const packageDirs = [
	path.join(nodeModules, "better-auth"),
	...readdirSync(path.join(nodeModules, "@better-auth")).map((name) =>
		path.join(nodeModules, "@better-auth", name),
	),
].map((dir) => realpathSync(dir));

const walk = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) {
			return name === "node_modules" ? [] : walk(full);
		}
		return full.endsWith(".mjs") ? [full] : [];
	});

type Source = { file: string; text: string };

const sources: Source[] = packageDirs
	.flatMap((dir) => {
		const dist = path.join(dir, "dist");
		return walk(existsSync(dist) ? dist : dir);
	})
	.filter((file) => !file.includes(`${path.sep}test-utils${path.sep}`))
	.map((file) => ({ file, text: readFileSync(file, "utf8") }));

/**
 * Module-level statements of a bundled file: each starts in column 0
 * with a keyword or a comment (a template literal's lines may start in
 * column 0 too, so any other line continues the statement).
 */
const topLevel = (text: string) =>
	text.split(
		/\n(?=(?:export|import|const|let|var|async|function|class)\b|\/[/*])/,
	);

const DECLARATION =
	/^(?:export\s+)?(?:async\s+)?function\s*\*?\s*([\w$]+)|^(?:export\s+)?(?:const|let|var)\s+([\w$]+)\s*=/;
const ENDPOINT = /\bcreate\w*Endpoint\(/g;

/**
 * A statement's own code, without the endpoints it creates (those are
 * checked as endpoints): an endpoint factory (`signInSocial()`) or a
 * plugin builds endpoints, it does not mint a session when called.
 */
const outsideEndpoints = (statement: string) => {
	const first = statement.search(/\bcreate\w*Endpoint\(/);
	return first < 0 ? statement : statement.slice(0, first);
};

/** One block per endpoint, ending at the next one or its statement's end. */
const endpointBlocks = (text: string) =>
	topLevel(text).flatMap((statement) => {
		const starts = [...statement.matchAll(ENDPOINT)].map((m) => m.index ?? 0);
		return starts.map((s, i) => statement.slice(s, starts[i + 1]));
	});

const escapeName = (name: string) => name.replace(/[$]/g, "\\$");
const callsAny = (names: Set<string>) => {
	const pattern = new RegExp(
		`(?<![\\w$])(?:${[...names].map(escapeName).join("|")})\\(`,
	);
	return (code: string) => pattern.test(code);
};

/** `a as b, c` → [["a", "b"], ["c", "c"]]. */
const bindings = (clause: string) =>
	clause
		.split(",")
		.map((part) => part.trim().split(/\s+as\s+/))
		.filter((pair) => pair[0])
		.map(([from, to]) => [from, to ?? from] as [string, string]);

/** Relative specifiers resolve to a scanned file; bare ones stay null. */
const resolveFrom = (file: string, spec: string) =>
	spec.startsWith(".") ? path.resolve(path.dirname(file), spec) : null;

type Link = { name: string; from: string | null; as: string };

function parseModule({ file, text }: Source) {
	const declarations = topLevel(text).flatMap((statement) => {
		const m = statement.match(DECLARATION);
		const name = m?.[1] ?? m?.[2];
		return name
			? [{ name, statement, exported: statement.startsWith("export ") }]
			: [];
	});
	const imports: Link[] = [];
	for (const m of text.matchAll(/\bimport\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)) {
		for (const [name, as] of bindings(m[1] ?? "")) {
			imports.push({ name, from: resolveFrom(file, m[2] ?? ""), as });
		}
	}
	const exports: Link[] = [];
	for (const m of text.matchAll(
		/\bexport\s*\{([^}]*)\}(?:\s*from\s*"([^"]+)")?/g,
	)) {
		for (const [name, as] of bindings(m[1] ?? "")) {
			exports.push({ name, from: m[2] ? resolveFrom(file, m[2]) : null, as });
		}
	}
	return { file, text, declarations, imports, exports };
}

/**
 * Session-minting function names per file: createSession and every
 * module-level function that calls one — transitively, wherever it sits
 * in its file, exported or not — followed through imports and exports
 * (bundles rename across chunks: `export { handleOAuthUserInfo as n }`).
 * A bare import (`better-auth/oauth2`) matches by its public name.
 */
function sessionMinters(sources: Source[]): Map<string, Set<string>> {
	const modules = sources.map(parseModule);
	const local = new Map(
		modules.map((m) => [m.file, new Set(["createSession"])] as const),
	);
	const exported = new Map<string, Set<string>>();
	const isExported = (link: Link) =>
		link.from === null
			? [...exported.values()].some((names) => names.has(link.name))
			: Boolean(exported.get(link.from)?.has(link.name));
	for (let grew = true; grew; ) {
		grew = false;
		for (const m of modules) {
			const names = local.get(m.file) ?? new Set<string>();
			const calls = callsAny(names);
			for (const { name, statement } of m.declarations) {
				if (!names.has(name) && calls(outsideEndpoints(statement))) {
					names.add(name);
					grew = true;
				}
			}
			for (const link of m.imports) {
				if (!names.has(link.as) && isExported(link)) {
					names.add(link.as);
					grew = true;
				}
			}
			const out = exported.get(m.file) ?? new Set<string>();
			const publish = (name: string) => {
				if (out.has(name)) return;
				out.add(name);
				grew = true;
			};
			for (const d of m.declarations) {
				if (d.exported && names.has(d.name)) publish(d.name);
			}
			for (const link of m.exports) {
				const minting =
					link.from === null ? names.has(link.name) : isExported(link);
				if (minting) publish(link.as);
			}
			exported.set(m.file, out);
		}
	}
	return local;
}

function sessionMintingPaths(sources: Source[]): string[] {
	const minters = sessionMinters(sources);
	const paths = new Set<string>();
	for (const { file, text } of sources) {
		const calls = callsAny(minters.get(file) ?? new Set(["createSession"]));
		for (const block of endpointBlocks(text)) {
			if (!calls(block)) continue;
			const literal = block.match(/^create\w*Endpoint\(\s*"([^"]+)"/);
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

describe("session-minter scan", () => {
	it("follows module-level helpers anywhere in a file, exported or not", () => {
		const fixture: Source[] = [
			{
				file: "/fixture/a.mjs",
				text: [
					'import { x as viaImport } from "./b.mjs";',
					'const first = createAuthEndpoint("/first", {}, async (ctx) => {',
					"\treturn mintLater(ctx);",
					"});",
					'const plain = createAuthEndpoint("/plain", {}, async (ctx) => {',
					"\treturn ctx.json({});",
					"});",
					"async function mintLater(ctx) {",
					"\treturn deeper(ctx);",
					"}",
					'const deeper = (ctx) => ctx.context.internalAdapter.createSession("u");',
					'const third = createAuthEndpoint("/third", {',
					"\tdescription: `Two lines,",
					"in column 0`,",
					"}, async (ctx) => {",
					"\treturn viaImport(ctx);",
					"});",
					"function makeEndpoint() {",
					'\treturn createAuthEndpoint("/made", {}, async (ctx) => ctx.context.internalAdapter.createSession("u"));',
					"}",
					'const listing = createAuthEndpoint("/listing", {}, async () => [makeEndpoint()]);',
					"export { first, plain, third, listing };",
				].join("\n"),
			},
			{
				file: "/fixture/b.mjs",
				text: [
					"function helper(ctx) {",
					'\treturn ctx.context.internalAdapter.createSession("u");',
					"}",
					"export { helper as x };",
				].join("\n"),
			},
		];
		// "/listing" only builds an endpoint ("/made"), it mints nothing.
		expect(sessionMintingPaths(fixture)).toEqual(["/first", "/made", "/third"]);
	});
});

describe("2FA guard coverage of Better Auth's session-minting endpoints", () => {
	const found = sessionMintingPaths(sources);

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
