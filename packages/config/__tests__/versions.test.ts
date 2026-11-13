import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_VERSION } from "../app-version";
import { KIT_VERSION } from "../index";

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

const rootPkg = JSON.parse(
	readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
) as { version?: string };

describe("version sources", () => {
	it("APP_VERSION is read from the root package.json", () => {
		expect(APP_VERSION).toBe(rootPkg.version);
	});

	it("APP_VERSION is valid semver", () => {
		expect(APP_VERSION).toMatch(SEMVER);
	});

	it("KIT_VERSION is valid semver", () => {
		expect(KIT_VERSION).toMatch(SEMVER);
	});

	it(".mcp.json announces the same kit version to the Fuutu MCP", () => {
		const mcp = JSON.parse(
			readFileSync(new URL("../../../.mcp.json", import.meta.url), "utf8"),
		) as { mcpServers: { fuutu: { headers: Record<string, string> } } };
		expect(mcp.mcpServers.fuutu.headers["X-Fuutu-Kit-Version"]).toBe(
			KIT_VERSION,
		);
	});
});
