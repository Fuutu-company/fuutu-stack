#!/usr/bin/env node
/**
 * Playwright MCP for this project — connects to the project's visible session
 * browser (`pnpm dev:session`) on its port-slot CDP port, so agents of several
 * projects or worktrees never drive each other's browser. `.mcp.json` runs
 * this instead of `@playwright/mcp` directly (it cannot read the slot).
 */
import { spawn } from "node:child_process";
import { join } from "node:path";
import { ensureSlot, findRoot, readProject } from "../ports/index.mjs";

const root = findRoot();
const project = readProject(root) ?? (await ensureSlot(root, { touch: false }));
const child = spawn(
	"pnpm",
	[
		"dlx",
		"@playwright/mcp@0.0.84",
		`--cdp-endpoint=http://127.0.0.1:${project.ports.browser}`,
		`--output-dir=${join(root, ".playwright-mcp-artifacts")}`,
		...process.argv.slice(2),
	],
	{ cwd: root, stdio: "inherit" },
);
child.on("exit", (code) => process.exit(code ?? 0));
