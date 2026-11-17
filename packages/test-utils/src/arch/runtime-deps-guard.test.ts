import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * CLI tools are dev dependencies: in `dependencies` they ship with the
 * production install and their advisories count as runtime ones
 * (`pnpm audit --prod`). The apps never import them.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const CLI_ONLY = ["shadcn"];

describe("runtime dependency guard", () => {
	it.each(["saas", "marketing", "docs"])(
		"apps/%s keeps CLI-only packages out of dependencies",
		(app) => {
			const pkg = JSON.parse(
				readFileSync(join(REPO_ROOT, "apps", app, "package.json"), "utf-8"),
			) as { dependencies?: Record<string, string> };
			for (const name of CLI_ONLY) {
				expect(Object.keys(pkg.dependencies ?? {})).not.toContain(name);
			}
		},
	);
});
