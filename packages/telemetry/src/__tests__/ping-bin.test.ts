import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const binPath = resolve(here, "../../bin/ping.mjs");
const guardPath = pathToFileURL(resolve(here, "fixtures/no-network.mjs")).href;
const capturePath = pathToFileURL(
	resolve(here, "fixtures/capture-fetch.mjs"),
).href;
const configPath = resolve(here, "../../../config/index.ts");

function runPing(env: NodeJS.ProcessEnv, withGuard = true) {
	const args = withGuard ? ["--import", guardPath, binPath] : [binPath];
	return spawnSync(process.execPath, args, {
		env: { ...process.env, ...env },
		encoding: "utf8",
		timeout: 15_000,
	});
}

const HASH_OF_EXAMPLE_KEY = "5b262a67a795ed7f721065d60ebd27c4";

/** Run the bin with fetch stubbed; returns the JSON body it would send. */
function capturePing(env: NodeJS.ProcessEnv): Record<string, unknown> {
	const result = spawnSync(
		process.execPath,
		["--import", capturePath, binPath],
		{
			env: {
				...process.env,
				FUUTU_TELEMETRY_DISABLED: "",
				// A build ping only goes out from CI or a production build.
				CI: "1",
				...env,
			},
			encoding: "utf8",
			timeout: 15_000,
		},
	);
	expect(result.status).toBe(0);
	const line = result.stdout.split("\n").find((l) => l.startsWith("PING "));
	if (!line) throw new Error(`no ping sent: ${result.stderr}`);
	return (JSON.parse(line.slice(5)) as { body: Record<string, unknown> }).body;
}

/** Whether the bin sends a ping in this environment (fetch stubbed). */
function pingSent(env: NodeJS.ProcessEnv): boolean {
	const result = spawnSync(
		process.execPath,
		["--import", capturePath, binPath],
		{
			env: { ...process.env, FUUTU_TELEMETRY_DISABLED: "", ...env },
			encoding: "utf8",
			timeout: 15_000,
		},
	);
	expect(result.status).toBe(0);
	return result.stdout.split("\n").some((l) => l.startsWith("PING "));
}

describe("bin/ping.mjs", () => {
	it("sends nothing from a plain local build (no CI, no production)", () => {
		expect(pingSent({ CI: "", NODE_ENV: "" })).toBe(false);
		expect(pingSent({ CI: "", NODE_ENV: "development" })).toBe(false);
		expect(pingSent({ CI: "false", NODE_ENV: "" })).toBe(false);
	});

	it("sends from CI", () => {
		expect(pingSent({ CI: "1", NODE_ENV: "" })).toBe(true);
		expect(pingSent({ CI: "true", NODE_ENV: "" })).toBe(true);
	});

	it("sends from a production build", () => {
		expect(pingSent({ CI: "", NODE_ENV: "production" })).toBe(true);
	});

	it("still honours FUUTU_TELEMETRY_DISABLED in CI", () => {
		expect(pingSent({ CI: "1", FUUTU_TELEMETRY_DISABLED: "1" })).toBe(false);
	});

	it("sends exactly the license-compliance fields, as a build ping", () => {
		const body = capturePing({
			FUUTU_LICENSE_KEY: "",
			NEXT_PUBLIC_SAAS_URL: "https://app.example.com",
		});
		expect(Object.keys(body).sort()).toEqual([
			"appUrl",
			"kind",
			"kitName",
			"kitVersion",
			"licenseKeyHash",
			"surface",
		]);
		expect(body).toMatchObject({
			kind: "build",
			surface: "web",
			licenseKeyHash: "oss",
			appUrl: "https://app.example.com",
		});
	});

	it("reports the desktop surface only for build:desktop", () => {
		expect(capturePing({ FUUTU_TELEMETRY_SURFACE: "desktop" }).surface).toBe(
			"desktop",
		);
		expect(capturePing({ FUUTU_TELEMETRY_SURFACE: "mobile" }).surface).toBe(
			"web",
		);
	});

	it("hashes the trimmed license key and sends appUrl null when unset", () => {
		const body = capturePing({
			FUUTU_LICENSE_KEY: "  fuutu_ent_example  ",
			NEXT_PUBLIC_SAAS_URL: "",
		});
		// sha256("fuutu_ent_example"), first 32 hex chars — same as
		// hashLicenseKey() in @fuutu/license.
		expect(body.licenseKeyHash).toBe(HASH_OF_EXAMPLE_KEY);
		expect(JSON.stringify(body)).not.toContain("fuutu_ent_example");
		expect(body.appUrl).toBeNull();
	});

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

describe("Docker builds", () => {
	it.each(["saas", "marketing", "docs"])(
		"apps/%s/Dockerfile runs the build ping as a production build",
		(app) => {
			const dockerfile = readFileSync(
				resolve(here, `../../../../apps/${app}/Dockerfile`),
				"utf8",
			);
			expect(dockerfile).toMatch(
				/NODE_ENV=production node packages\/telemetry\/bin\/ping\.mjs/,
			);
		},
	);
});
