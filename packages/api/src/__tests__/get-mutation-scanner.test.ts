/**
 * GET-mutation scanner — a procedure declared `method: "GET"` counts as a
 * read everywhere: the router policy skips its rate-limit and
 * sensitive-prefix checks, the CSRF origin guard skips it, and Lax cookies
 * ride along on a cross-site top-level GET (`<a href>`). One that writes
 * would be a one-click CSRF. This static scan fails when a GET procedure
 * file imports or calls something that writes.
 *
 * Writes are recognised by name: identifiers imported from `@fuutu/*`
 * packages and `auth.api.<endpoint>` calls whose name starts with a
 * mutating verb (`createX`, `deleteX`, `revokeX`, …). Make it a POST /
 * PATCH / DELETE — or, for a genuine read that matches by name, list the
 * file in GET_MUTATION_EXCEPTIONS with the reason.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const API_MODULES_DIR = join(import.meta.dirname, "..", "modules");

/** Module-relative file → why its matching names do not write. */
const GET_MUTATION_EXCEPTIONS: Readonly<Record<string, string>> = {};

const MUTATING_VERBS = [
	"accept",
	"add",
	"ban",
	"cancel",
	"charge",
	"claim",
	"clear",
	"consume",
	"create",
	"deduct",
	"delete",
	"dispatch",
	"enqueue",
	"grant",
	"impersonate",
	"increment",
	"insert",
	"invite",
	"leave",
	"mark",
	"move",
	"purge",
	"put",
	"record",
	"refund",
	"reject",
	"remove",
	"reset",
	"resend",
	"revoke",
	"rotate",
	"save",
	"send",
	"set",
	"spend",
	"stop",
	"store",
	"touch",
	"transfer",
	"unban",
	"update",
	"upload",
	"upsert",
	"write",
];

function isMutatingName(name: string): boolean {
	// Case-insensitive on the verb, but `settings`/`address` must not count:
	// after the verb comes the end, `_` or an upper-case letter.
	const match = name.match(
		new RegExp(`^(admin|support)?(${MUTATING_VERBS.join("|")})`, "i"),
	);
	if (!match) return false;
	const rest = name.slice(match[0].length);
	return rest === "" || /^[A-Z_]/.test(rest);
}

function findTsFiles(dir: string): string[] {
	const results: string[] = [];
	for (const entry of readdirSync(dir)) {
		const fullPath = join(dir, entry);
		if (statSync(fullPath).isDirectory()) {
			results.push(...findTsFiles(fullPath));
		} else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
			results.push(fullPath);
		}
	}
	return results;
}

/** Packages whose exports never write application data. */
const NON_WRITER_PACKAGES: ReadonlySet<string> = new Set(["@fuutu/logs"]);

/**
 * True when the file declares an oRPC procedure with `method: "GET"` in a
 * `.route({ ... })` call — not an outbound request's `method: "GET"`.
 */
function isGetProcedure(source: string): boolean {
	return /\.route\(\s*\{(?:[^{}]|\{[^{}]*\})*?\bmethod:\s*"GET"/.test(source);
}

/** Names imported (values, not types) from `@fuutu/*` packages. */
function fuutuImports(source: string): string[] {
	const names: string[] = [];
	const re = /import\s*\{([^}]*)\}\s*from\s*"(@fuutu\/[^"]+)"/g;
	for (const match of source.matchAll(re)) {
		if (/^\s*import\s+type\b/.test(match[0])) continue;
		// Logger factories (`createLogger`) are not data writers.
		if (NON_WRITER_PACKAGES.has(match[2] ?? "")) continue;
		for (const raw of (match[1] ?? "").split(",")) {
			const name = raw.trim();
			if (!name || name.startsWith("type ")) continue;
			names.push(name.split(/\s+as\s+/)[0] ?? name);
		}
	}
	return names;
}

/** `auth.api.<endpoint>` calls. */
function authApiCalls(source: string): string[] {
	return [...source.matchAll(/\bauth\.api\.(\w+)/g)].map((m) => m[1] ?? "");
}

function writesIn(source: string): string[] {
	return [
		...fuutuImports(source).filter(isMutatingName),
		...authApiCalls(source)
			.filter(isMutatingName)
			.map((name) => `auth.api.${name}`),
	];
}

describe("mutating-name detection", () => {
	it.each([
		"createWebhook",
		"deleteApiKey",
		"revokeOAuthTokensForUser",
		"adminSetSystemRole",
		"supportRemoveMember",
		"dispatchEvent",
		"recordAdminAction",
		"upsert",
	])("flags %s", (name) => {
		expect(isMutatingName(name)).toBe(true);
	});

	it.each([
		"listWebhooks",
		"getUserAccessState",
		"countApiKeys",
		"settingsSchema",
		"address",
		"recordsPerPage",
		"isUserSessionLive",
		"adminListUsers",
	])("leaves %s alone", (name) => {
		expect(isMutatingName(name)).toBe(false);
	});

	it("ignores the logger factory imported from @fuutu/logs", () => {
		const source = [
			'import { createLogger } from "@fuutu/logs";',
			'import { listX } from "@fuutu/db";',
		].join("\n");
		expect(writesIn(source)).toEqual([]);
	});

	it("still flags createLogger-like names from a data package", () => {
		expect(writesIn('import { createThing } from "@fuutu/db";')).toEqual([
			"createThing",
		]);
	});

	it("reads value imports and auth.api calls, not type imports", () => {
		const source = [
			'import { listX, createX as make } from "@fuutu/db";',
			'import type { DeleteResult } from "@fuutu/db";',
			'import { type UpdateInput, getY } from "@fuutu/db";',
			"await auth.api.revokeUserSessions({});",
			"await auth.api.listInvitations({});",
		].join("\n");
		expect(writesIn(source)).toEqual([
			"createX",
			"auth.api.revokeUserSessions",
		]);
	});
});

describe("GET procedure detection", () => {
	it("recognises a GET oRPC route", () => {
		const source = [
			"export const p = authProcedure()",
			"\t.route({",
			'\t\tmethod: "GET",',
			'\t\tpath: "/x",',
			"\t})",
		].join("\n");
		expect(isGetProcedure(source)).toBe(true);
	});

	it("recognises a GET route with nested objects before the method", () => {
		const source =
			'.route({ spec: { tags: ["a"] }, method: "GET", path: "/x" })';
		expect(isGetProcedure(source)).toBe(true);
	});

	it("ignores method: GET in an outbound request's options", () => {
		const source = [
			'import { request } from "node:https";',
			'const req = request({ host: "example.com", method: "GET" });',
		].join("\n");
		expect(isGetProcedure(source)).toBe(false);
	});

	it("ignores a POST route that sits next to an outbound GET", () => {
		const source = [
			'.route({ method: "POST", path: "/x" })',
			'await fetch(url, { method: "GET" });',
		].join("\n");
		expect(isGetProcedure(source)).toBe(false);
	});
});

describe("GET procedures never write", () => {
	const getFiles = findTsFiles(API_MODULES_DIR).filter((file) =>
		isGetProcedure(readFileSync(file, "utf8")),
	);

	it("finds the GET procedures", () => {
		expect(getFiles.length).toBeGreaterThan(10);
	});

	it("no GET procedure file imports or calls a writer", () => {
		const problems: string[] = [];
		for (const file of getFiles) {
			const rel = relative(API_MODULES_DIR, file);
			if (GET_MUTATION_EXCEPTIONS[rel]) continue;
			const writes = writesIn(readFileSync(file, "utf8"));
			if (writes.length > 0) {
				problems.push(
					`${rel} is a GET procedure but uses ${writes.join(", ")} — GET skips rate limits and the CSRF origin guard; make it POST/PATCH/DELETE, or list the file in GET_MUTATION_EXCEPTIONS with why it does not write.`,
				);
			}
		}
		expect(problems).toEqual([]);
	});

	it("lists only exceptions that are still needed", () => {
		const problems: string[] = [];
		for (const [rel, reason] of Object.entries(GET_MUTATION_EXCEPTIONS)) {
			if (!reason.trim()) problems.push(`${rel}: the exception needs a reason`);
			const file = getFiles.find(
				(candidate) => relative(API_MODULES_DIR, candidate) === rel,
			);
			if (!file) {
				problems.push(
					`${rel}: not a GET procedure file — remove the exception`,
				);
			} else if (writesIn(readFileSync(file, "utf8")).length === 0) {
				problems.push(`${rel}: uses no writer — remove the exception`);
			}
		}
		expect(problems).toEqual([]);
	});
});
