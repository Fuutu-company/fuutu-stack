import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/env/saas", () => ({ env: {} }));

const { buildTelemetryPayload } = await import("../index");

const here = dirname(fileURLToPath(import.meta.url));
const license = readFileSync(resolve(here, "../../../../LICENSE.md"), "utf8");

/** Body of a top-level `## <n>.` section of LICENSE.md. */
function section(number: string): string {
	const start = license.search(new RegExp(`^## ${number}\\. `, "m"));
	if (start === -1) throw new Error(`LICENSE.md has no section ${number}`);
	const rest = license.slice(start + 3);
	const end = rest.search(/^## /m);
	return end === -1 ? rest : rest.slice(0, end);
}

describe("LICENSE.md §7 matches the telemetry payload", () => {
	// The field list: bullets of the form "- `fieldName`: …".
	const listed = [...section("7").matchAll(/^\s*- `(\w+)`:/gm)].map(
		(match) => match[1],
	);

	it("lists exactly the fields the ping sends", () => {
		expect(listed.length).toBeGreaterThan(0);
		expect([...listed].sort()).toEqual(
			Object.keys(buildTelemetryPayload()).sort(),
		);
	});

	it("names no removed field anywhere in the license", () => {
		for (const removed of ["nodeVersion", "sentAt", "feature names"]) {
			expect(license, removed).not.toContain(removed);
		}
	});
});
