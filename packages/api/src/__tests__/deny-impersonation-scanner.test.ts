/**
 * Deny-impersonation scanner — static source scan, no runtime.
 *
 * Every mutation (route method other than GET; oRPC's default is POST)
 * under `modules/{payments,api-keys,webhooks,organizations,users}/**\/procedures/`
 * must reject impersonation sessions: `authProcedure({ denyImpersonation:
 * true })` or `.use(denyImpersonation)`. A new mutation in these modules
 * fails here until it is guarded or added to the allow-list below with a
 * reason. `deny-impersonation.test.ts` proves the guard rejects at runtime.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const MODULES_DIR = join(__dirname, "..", "modules");
const SCANNED_MODULES = [
	"payments",
	"api-keys",
	"webhooks",
	"organizations",
	"users",
];

/** Mutations support may run as the user — each with its reason. */
const ALLOWED_WHILE_IMPERSONATING: ReadonlyMap<string, string> = new Map([
	[
		"organizations/procedures/create.ts",
		"creates a new organization of the user's own and changes nothing that exists (Better Auth /organization/create is allowed too)",
	],
]);

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

function isProcedureFile(content: string): boolean {
	return content.includes(".handler(");
}

/** A procedure without an explicit method is a POST in oRPC. */
function isMutation(content: string): boolean {
	const methods = [...content.matchAll(/\bmethod\s*:\s*"([A-Z]+)"/g)].map(
		(match) => match[1],
	);
	return methods.length === 0 || methods.some((method) => method !== "GET");
}

function deniesImpersonation(content: string): boolean {
	return (
		/\bdenyImpersonation\s*:\s*true\b/.test(content) ||
		/\.use\(\s*denyImpersonation\s*\)/.test(content)
	);
}

const procedureFiles = SCANNED_MODULES.flatMap((module) =>
	findTsFiles(join(MODULES_DIR, module)),
)
	.filter((file) => file.split(sep).includes("procedures"))
	.map((file) => ({
		path: relative(MODULES_DIR, file).split(sep).join("/"),
		content: readFileSync(file, "utf-8"),
	}))
	.filter(({ content }) => isProcedureFile(content));

describe("scanner detection", () => {
	it("treats non-GET and method-less procedures as mutations", () => {
		expect(isMutation('.route({ method: "DELETE", path: "/x" })')).toBe(true);
		expect(isMutation('.route({ method: "PATCH" })')).toBe(true);
		expect(isMutation(".handler(async () => 1)")).toBe(true);
		expect(isMutation('.route({ method: "GET" })')).toBe(false);
	});

	it("accepts the option and the middleware form", () => {
		expect(
			deniesImpersonation("authProcedure({ denyImpersonation: true })"),
		).toBe(true);
		expect(
			deniesImpersonation("protectedProcedure\n\t.use(denyImpersonation)"),
		).toBe(true);
		expect(
			deniesImpersonation("authProcedure({ denyImpersonation: false })"),
		).toBe(false);
		expect(deniesImpersonation('import { denyImpersonation } from "x"')).toBe(
			false,
		);
	});
});

describe("deny-impersonation scanner", () => {
	it("finds the procedure files", () => {
		const paths = procedureFiles.map((file) => file.path);
		expect(paths).toContain("payments/procedures/create-checkout.ts");
		expect(paths).toContain("users/procedures/update-user-profile.ts");
	});

	it("allow-list entries exist and are mutations", () => {
		for (const path of ALLOWED_WHILE_IMPERSONATING.keys()) {
			const file = procedureFiles.find((candidate) => candidate.path === path);
			expect(file, path).toBeDefined();
			expect(isMutation(file?.content ?? ""), path).toBe(true);
		}
	});

	const mutations = procedureFiles.filter(
		({ path, content }) =>
			isMutation(content) && !ALLOWED_WHILE_IMPERSONATING.has(path),
	);

	it.each(mutations)(
		"$path rejects impersonation sessions",
		({ path, content }) => {
			if (!deniesImpersonation(content)) {
				throw new Error(
					`${path} is a mutation without denyImpersonation. Add \`denyImpersonation: true\` to authProcedure(...) or \`.use(denyImpersonation)\`, or list it in ALLOWED_WHILE_IMPERSONATING with a reason.`,
				);
			}
		},
	);
});
