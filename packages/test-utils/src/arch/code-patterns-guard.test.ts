import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: the code patterns of AGENTS.md §6 that a scan can prove.
 * Scans app and package source (`apps/<app>/src`, `packages/<pkg>/src`),
 * never tests or scripts. Each rule's message carries the fix; an exception
 * goes into the rule's `allow` list with a reason.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");

type Rule = {
	id: string;
	pattern: RegExp;
	/** Repo-relative path prefixes the rule applies to (all source if unset). */
	only?: string[];
	/** Repo-relative path prefixes (or `*\/name` file names) that may break it, with the reason. */
	allow: Record<string, string>;
	fix: string;
};

const RULES: Rule[] = [
	{
		id: "no-console",
		pattern: /\bconsole\.(log|info|debug|warn|error|trace)\s*\(/,
		allow: {
			"packages/logs/": "the logger itself mirrors to the console",
			"*/instrumentation.ts":
				"runs before the logger is initialised (startup warnings)",
		},
		fix: 'use `createLogger({ scope: "<area>" })` from `@fuutu/logs` instead of `console.*`',
	},
	{
		id: "env-via-fuutu-env",
		pattern: /\bprocess\.env\b/,
		allow: {
			"packages/env/": "the validated env schemas",
			"packages/logs/":
				"logger config is read before @fuutu/env (env imports logs)",
			"packages/utils/src/base-url.ts":
				"shared by apps with different env schemas",
			"*/instrumentation.ts": "runtime detection before env validation",
		},
		fix: "read env through `@fuutu/env/saas` | `/marketing` | `/docs`; add a new var to its Zod schema in `packages/env/src/` and to `.env.example`",
	},
	{
		id: "ui-framework-agnostic",
		pattern:
			/from\s*["']next(\/[^"']*)?["']|import\s*\(\s*["']next(\/[^"']*)?["']/,
		only: ["packages/ui/"],
		allow: {},
		fix: "`@fuutu/ui` stays framework-agnostic — take the Next.js piece (Link, Image, router) as a prop or slot from the app",
	},
	{
		id: "single-cn",
		pattern: /from\s*["'](clsx|tailwind-merge)["']/,
		allow: { "packages/utils/src/cn.ts": "the one `cn`" },
		fix: 'import `cn` from "@fuutu/utils/cn" instead of combining clsx / tailwind-merge yourself',
	},
];

const SKIP_DIRS = new Set([
	"node_modules",
	".next",
	".next-e2e",
	".turbo",
	".source",
	"dist",
	"generated",
	"zod",
	"__tests__",
	"tests",
]);
const SOURCE_FILE = /\.(ts|tsx)$/;
const TEST_FILE = /\.(test|spec)\.(ts|tsx)$|\.d\.ts$/;

function walk(dir: string, out: string[] = []): string[] {
	let entries: import("node:fs").Dirent[];
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), out);
		} else if (SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name)) {
			out.push(join(dir, entry.name));
		}
	}
	return out;
}

function sourceRoots(): string[] {
	const roots: string[] = [];
	for (const parent of ["apps", "packages"]) {
		for (const name of readdirSync(join(REPO_ROOT, parent))) {
			roots.push(join(REPO_ROOT, parent, name, "src"));
		}
	}
	return roots;
}

function allowed(rule: Rule, path: string): boolean {
	return Object.keys(rule.allow).some((prefix) =>
		prefix.startsWith("*/")
			? path.endsWith(prefix.slice(1))
			: path.startsWith(prefix),
	);
}

/** Lines that only hold a comment are documentation, not code. */
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*)/;

function findViolations(
	files: { path: string; source: string }[],
	rules: Rule[] = RULES,
): string[] {
	const found: string[] = [];
	for (const { path, source } of files) {
		for (const rule of rules) {
			if (rule.only && !rule.only.some((p) => path.startsWith(p))) continue;
			if (allowed(rule, path)) continue;
			source.split("\n").forEach((line, i) => {
				if (!COMMENT_LINE.test(line) && rule.pattern.test(line)) {
					found.push(`${path}:${i + 1} [${rule.id}] — ${rule.fix}`);
				}
			});
		}
	}
	return found;
}

describe("code patterns guard", () => {
	it.each([
		["apps/saas/src/x.ts", 'console.log("hi");', "no-console"],
		[
			"packages/api/src/x.ts",
			"const k = process.env.SECRET;",
			"env-via-fuutu-env",
		],
		[
			"packages/ui/src/x.tsx",
			'import Link from "next/link";',
			"ui-framework-agnostic",
		],
		[
			"apps/saas/src/x.tsx",
			'import { twMerge } from "tailwind-merge";',
			"single-cn",
		],
	])("flags a planted violation: %s", (path, source, id) => {
		const [hit] = findViolations([{ path, source }]);
		expect(hit).toContain(`[${id}]`);
		expect(hit).toContain(`${path}:1`);
	});

	it.each([
		["packages/logs/src/x.ts", 'console.info("[audit]");'],
		["apps/saas/src/instrumentation.ts", "if (process.env.NEXT_RUNTIME) {}"],
		["packages/env/src/saas.ts", "process.env.DATABASE_URL"],
		["apps/saas/src/x.tsx", 'import Link from "next/link";'],
		["packages/utils/src/cn.ts", 'import { clsx } from "clsx";'],
		["apps/saas/src/x.ts", "// never use process.env here"],
	])("allows: %s", (path, source) => {
		expect(findViolations([{ path, source }])).toEqual([]);
	});

	it("every allow-list entry gives a reason", () => {
		for (const rule of RULES) {
			for (const reason of Object.values(rule.allow)) {
				expect(reason.length, rule.id).toBeGreaterThan(10);
			}
		}
	});

	it("app and package source follow the code patterns", () => {
		const files = sourceRoots()
			.flatMap((root) => walk(root))
			.map((file) => ({
				path: relative(REPO_ROOT, file).split(sep).join("/"),
				source: readFileSync(file, "utf8"),
			}));
		expect(files.length).toBeGreaterThan(100);
		const violations = findViolations(files);
		expect(
			violations,
			`AGENTS.md §6 code patterns broken:\n${violations.join("\n")}`,
		).toEqual([]);
	});
});
