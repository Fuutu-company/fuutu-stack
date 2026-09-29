import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const binPath = resolve(here, "../../bin/ping.mjs");
const guardPath = pathToFileURL(resolve(here, "fixtures/no-network.mjs")).href;
const configPath = resolve(here, "../../../config/index.ts");

function runPing(env: NodeJS.ProcessEnv, withGuard = true) {
	const args = withGuard ? ["--import", guardPath, binPath] : [binPath];
	return spawnSync(process.execPath, args, {
		env: { ...process.env, ...env },
		encoding: "utf8",
		timeout: 15_000,
	});
}

describe("bin/ping.mjs", () => {
	it("exits 0 and makes no network attempt when FUUTU_TELEMETRY_DISABLED=1", () => {
		const result = runPing({ FUUTU_TELEMETRY_DISABLED: "1" });
		expect(result.status).toBe(0);
		expect(result.stderr).not.toContain("network attempt detected");
	});

	it("exits 0 and makes no network attempt when FUUTU_TELEMETRY_DISABLED=TRUE", () => {
		const result = runPing({ FUUTU_TELEMETRY_DISABLED: "TRUE" });
		expect(result.status).toBe(0);
		expect(result.stderr).not.toContain("network attempt detected");
	});

	it("still exits 0 when the endpoint is unreachable (silent failure)", () => {
		const result = runPing(
			{
				FUUTU_TELEMETRY_DISABLED: "",
				FUUTU_TELEMETRY_ENDPOINT: "http://127.0.0.1:1/",
			},
			false,
		);
		expect(result.status).toBe(0);
	});

	it("keeps KIT_VERSION in sync with @fuutu/config", () => {
		const binSource = readFileSync(binPath, "utf8");
		const configSource = readFileSync(configPath, "utf8");
		const binVersion = /KIT_VERSION\s*=\s*"([^"]+)"/.exec(binSource)?.[1];
		const configVersion = /KIT_VERSION\s*=\s*"([^"]+)"/.exec(configSource)?.[1];
		expect(binVersion).toBeDefined();
		expect(binVersion).toBe(configVersion);
	});
});
