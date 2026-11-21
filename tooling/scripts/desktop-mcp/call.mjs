#!/usr/bin/env node
/**
 * Minimal MCP client for the desktop automation server — for scripted
 * checks (`apps/desktop/tests/smoke.mcp.mjs`) and for agents without the
 * `tauri` MCP server loaded in their session.
 *
 *   node tooling/scripts/desktop-mcp/call.mjs tools
 *   node tooling/scripts/desktop-mcp/call.mjs <tool> '<json args>' [<tool> '<json>' …]
 *
 * Image results are written to .fuutu/desktop-shots/<n>.png and printed as
 * paths. Exit code 1 when a call returns `isError`.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import { findRoot } from "../../ports/index.mjs";

export async function connectDesktopMcp({ root = findRoot() } = {}) {
	const child = spawn(
		process.execPath,
		[join(root, "tooling/scripts/desktop-mcp.mjs")],
		{ cwd: root, stdio: ["pipe", "pipe", "inherit"] },
	);
	const pending = new Map();
	let nextId = 1;
	createInterface({ input: child.stdout }).on("line", (line) => {
		let message;
		try {
			message = JSON.parse(line);
		} catch {
			return;
		}
		const waiter = pending.get(message.id);
		if (!waiter) return;
		pending.delete(message.id);
		if (message.error) waiter.reject(new Error(message.error.message));
		else waiter.resolve(message.result);
	});
	child.on("exit", (code) => {
		for (const waiter of pending.values()) {
			waiter.reject(new Error(`desktop MCP server exited (${code})`));
		}
		pending.clear();
	});
	const request = (method, params) =>
		new Promise((resolve, reject) => {
			const id = nextId++;
			pending.set(id, { resolve, reject });
			child.stdin.write(
				`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
			);
		});
	await request("initialize", {
		protocolVersion: "2024-11-05",
		capabilities: {},
		clientInfo: { name: "desktop-mcp-call", version: "1.0.0" },
	});
	child.stdin.write(
		`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
	);
	return {
		listTools: async () => (await request("tools/list", {})).tools,
		call: (name, args = {}) => request("tools/call", { name, arguments: args }),
		close: () => child.kill("SIGTERM"),
	};
}

/** Text of a tool result; images saved under `dir`, their paths inlined. */
export function renderResult(result, dir, prefix) {
	const parts = [];
	let n = 0;
	for (const item of result?.content ?? []) {
		if (item.type === "text") parts.push(item.text);
		else if (item.type === "image") {
			mkdirSync(dir, { recursive: true });
			const file = join(dir, `${prefix}-${++n}.png`);
			writeFileSync(file, Buffer.from(item.data, "base64"));
			parts.push(`[image] ${file}`);
		}
	}
	return parts.join("\n");
}

async function main() {
	const args = process.argv.slice(2);
	const root = findRoot();
	const client = await connectDesktopMcp({ root });
	let failed = false;
	try {
		if (args[0] === "tools") {
			for (const tool of await client.listTools()) {
				process.stdout.write(
					`${tool.name}: ${tool.description?.split("\n")[0] ?? ""}\n`,
				);
			}
			return;
		}
		for (let i = 0; i < args.length; i += 2) {
			const name = args[i];
			const input = args[i + 1] ? JSON.parse(args[i + 1]) : {};
			const result = await client.call(name, input);
			const shots = join(root, ".fuutu/desktop-shots");
			process.stdout.write(
				`── ${name}\n${renderResult(result, shots, `${Date.now()}-${name}`)}\n`,
			);
			if (result?.isError) failed = true;
		}
	} finally {
		client.close();
	}
	process.exit(failed ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	await main();
}
