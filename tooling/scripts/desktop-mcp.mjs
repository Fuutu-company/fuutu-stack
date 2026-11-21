#!/usr/bin/env node
/**
 * Desktop automation MCP for this project — drives the running desktop app
 * (`pnpm dev:desktop`, debug build) the way the Playwright MCP drives the
 * session browser: windows, DOM / accessibility snapshots, clicks, typing,
 * screenshots, console + logs, JS eval, Tauri commands and events.
 *
 * Runs `@hypothesi/tauri-mcp-server` (devDependency of apps/desktop) against
 * the slot's `desktopBridge` port on 127.0.0.1 and adds the per-checkout
 * bridge token (`.fuutu/desktop-bridge.json`) to its WebSocket handshake
 * (./desktop-mcp/ws-token-hook.mjs). The bridge only exists in debug builds
 * and refuses clients without the token or with an `Origin` header.
 *
 * With `config.features.desktop` off it still starts (the MCP entry must not
 * fail) — its tools just report that no app is running.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ensureSlot, findRoot, readProject } from "../ports/index.mjs";

const root = findRoot();
const project = readProject(root) ?? (await ensureSlot(root, { touch: false }));

// The package exports no package.json — resolve its bin through the
// desktop app's node_modules link.
const serverBin = join(
	root,
	"apps/desktop/node_modules/@hypothesi/tauri-mcp-server/dist/index.js",
);
if (!existsSync(serverBin)) {
	process.stderr.write(
		"desktop-mcp: @hypothesi/tauri-mcp-server is not installed (run pnpm install)\n",
	);
	process.exit(1);
}

const hook = pathToFileURL(
	join(import.meta.dirname, "desktop-mcp/ws-token-hook.mjs"),
).href;
const child = spawn(
	process.execPath,
	["--import", hook, serverBin, ...process.argv.slice(2)],
	{
		cwd: root,
		stdio: "inherit",
		env: {
			...process.env,
			MCP_BRIDGE_HOST: "127.0.0.1",
			MCP_BRIDGE_PORT: String(project.ports.desktopBridge),
			MCP_BRIDGE_CWD: join(root, "apps/desktop"),
			FUUTU_DESKTOP_BRIDGE_TOKEN_FILE: join(root, ".fuutu/desktop-bridge.json"),
		},
	},
);
child.on("exit", (code) => process.exit(code ?? 0));
