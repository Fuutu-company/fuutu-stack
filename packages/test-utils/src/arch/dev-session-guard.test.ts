import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: the live dev session (tooling/scripts/dev-session.mjs) and the
 * tools that rely on it stay wired together — the Playwright MCP drives the
 * visible session browser, Claude Code starts the session, `pnpm dev:session`
 * exists.
 */
const REPO_ROOT = join(import.meta.dirname, "../../../../");
const read = (...p: string[]) => readFileSync(join(REPO_ROOT, ...p), "utf8");

describe("dev session guard", () => {
	it("the Playwright MCP runs through the slot-aware wrapper", () => {
		const mcp = JSON.parse(read(".mcp.json"));
		expect(mcp.mcpServers.playwright).toEqual({
			command: "node",
			args: ["tooling/scripts/playwright-mcp.mjs"],
		});
		const wrapper = read("tooling", "scripts", "playwright-mcp.mjs");
		// Literal source text of the wrapper's template string.
		const endpoint = [
			"--cdp-endpoint=http://127.0.0.1:$",
			"{project.ports.browser}",
		];
		expect(wrapper).toContain(endpoint.join(""));
	});

	it("the session browser listens on the slot's browser port", () => {
		const script = read("tooling", "scripts", "dev-session.mjs");
		expect(script).toContain("const CDP_PORT = PROJECT?.ports.browser;");
	});

	it("no app script hard-codes a port — the launcher reads the slot", () => {
		for (const app of ["saas", "marketing", "docs", "mail-preview"]) {
			const { scripts } = JSON.parse(read("apps", app, "package.json"));
			expect(scripts.dev).toBe(
				`node ../../tooling/scripts/next.mjs dev ${app}`,
			);
			expect(scripts.start).toBe(
				`node ../../tooling/scripts/next.mjs start ${app}`,
			);
		}
	});

	it("Claude Code starts the session on SessionStart, detached", () => {
		const settings = JSON.parse(read(".claude", "settings.json"));
		const commands: string[] = (settings.hooks?.SessionStart ?? []).flatMap(
			(h: { hooks: { command: string }[] }) => h.hooks.map((x) => x.command),
		);
		expect(commands.some((c) => /dev-session\.mjs" ensure$/.test(c))).toBe(
			true,
		);
	});

	it("`pnpm dev:session` runs the script", () => {
		const pkg = JSON.parse(read("package.json"));
		expect(pkg.scripts["dev:session"]).toBe(
			"node tooling/scripts/dev-session.mjs",
		);
	});
});
