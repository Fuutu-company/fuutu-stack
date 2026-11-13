import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: apps add public (no login redirect) route prefixes only in
 * `apps/saas/src/proxy-public.ts`, never by editing proxy.ts — and every
 * entry carries a `// reason:` comment saying how the route authenticates
 * itself (signature, API key, shared secret, public by design).
 */

const SAAS_SRC = join(import.meta.dirname, "../../../../apps/saas/src");
const read = (file: string) => readFileSync(join(SAAS_SRC, file), "utf8");

/** Body of `export const APP_PUBLIC_PREFIXES … = [ … ]`. */
function prefixListBody(source: string): string {
	const match = source.match(
		// Anchored at line start so the doc-comment example is skipped.
		/^export const APP_PUBLIC_PREFIXES[^=]*=\s*\[([\s\S]*?)\];?\s*$/m,
	);
	if (!match) throw new Error("APP_PUBLIC_PREFIXES array not found");
	return match[1] ?? "";
}

/** Each string entry together with the comment lines directly above it. */
function entriesWithComments(
	body: string,
): { value: string; comment: string }[] {
	const entries: { value: string; comment: string }[] = [];
	let comment: string[] = [];
	for (const raw of body.split("\n")) {
		const line = raw.trim();
		if (line.startsWith("//")) {
			comment.push(line);
			continue;
		}
		const value = line.match(/^["'`]([^"'`]*)["'`],?$/)?.[1];
		if (value !== undefined) {
			entries.push({ value, comment: comment.join(" ") });
		}
		if (line) comment = [];
	}
	return entries;
}

describe("proxy public-prefix extension point", () => {
	it("every APP_PUBLIC_PREFIXES entry is documented with a `// reason:` comment", () => {
		const entries = entriesWithComments(
			prefixListBody(read("proxy-public.ts")),
		);
		for (const entry of entries) {
			expect(entry.comment, `entry "${entry.value}"`).toMatch(/\/\/ reason:/);
			expect(entry.value.startsWith("/"), `entry "${entry.value}"`).toBe(true);
		}
	});

	it("proxy.ts treats APP_PUBLIC_PREFIXES as public", () => {
		const proxy = read("proxy.ts");
		expect(proxy).toMatch(
			/import\s*\{\s*APP_PUBLIC_PREFIXES\s*\}\s*from\s*["']\.\/proxy-public["']/,
		);
		expect(proxy).toMatch(/\.\.\.APP_PUBLIC_PREFIXES/);
	});

	it("the reason check rejects an undocumented entry", () => {
		const entries = entriesWithComments(
			'\n\t// reason: signed webhook\n\t"/api/hooks",\n\t"/api/open",\n',
		);
		expect(entries).toEqual([
			{ value: "/api/hooks", comment: "// reason: signed webhook" },
			{ value: "/api/open", comment: "" },
		]);
	});
});
