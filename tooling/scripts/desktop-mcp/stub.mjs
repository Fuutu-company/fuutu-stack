/**
 * Stand-in for the desktop automation MCP server when apps/desktop (or its
 * dependencies) is absent: answers the MCP handshake with no tools, so the
 * `.mcp.json` entry never shows up as a failed server.
 */
import { createInterface } from "node:readline";

const reply = (id, result) =>
	process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);

createInterface({ input: process.stdin }).on("line", (line) => {
	let message;
	try {
		message = JSON.parse(line);
	} catch {
		return;
	}
	if (message.id === undefined) return;
	if (message.method === "initialize") {
		reply(message.id, {
			protocolVersion: message.params?.protocolVersion ?? "2024-11-05",
			capabilities: { tools: {} },
			serverInfo: { name: "desktop (not installed)", version: "0.0.0" },
		});
	} else if (message.method === "tools/list") {
		reply(message.id, { tools: [] });
	} else {
		process.stdout.write(
			`${JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "apps/desktop is not installed" } })}\n`,
		);
	}
});
