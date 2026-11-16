import { describe, expect, it } from "vitest";
import {
	initialApiKeyScopes,
	offeredApiKeyScopes,
} from "../../../../apps/saas/src/modules/app/api-keys/scope-selection";

/**
 * The create dialog's scope selection (`ApiKeyCreateDialog`): which scopes
 * a viewer is offered and which a preset (`presetScopes`, e.g. the MCP
 * section on an Agents page) pre-checks. The API stays authoritative.
 */

const ALL = ["mcp", "versioning", "api", "maintainer"] as const;
const ADMIN_ONLY = ["maintainer"] as const;

describe("offeredApiKeyScopes", () => {
	it("hides admin-only scopes from non-admins", () => {
		expect(offeredApiKeyScopes(ALL, ADMIN_ONLY, false)).toEqual([
			"mcp",
			"versioning",
			"api",
		]);
	});

	it("offers every scope to a system admin", () => {
		expect(offeredApiKeyScopes(ALL, ADMIN_ONLY, true)).toEqual([...ALL]);
	});
});

describe("initialApiKeyScopes", () => {
	const offered = ["mcp", "versioning", "api"] as const;

	it("checks only the preset scopes", () => {
		expect(initialApiKeyScopes(offered, ["versioning"])).toEqual([
			"versioning",
		]);
	});

	it("drops a preset scope the viewer is not offered", () => {
		expect(initialApiKeyScopes(offered, ["maintainer", "mcp"])).toEqual([
			"mcp",
		]);
	});

	it("drops unknown preset scopes, leaving nothing to submit", () => {
		expect(initialApiKeyScopes(offered, ["root"])).toEqual([]);
	});

	it("keeps the offered order, not the preset order", () => {
		expect(initialApiKeyScopes(offered, ["api", "mcp"])).toEqual([
			"mcp",
			"api",
		]);
	});
});
