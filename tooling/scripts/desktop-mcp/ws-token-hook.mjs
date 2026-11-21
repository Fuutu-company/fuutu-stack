/**
 * Node module hook for the desktop automation MCP server: every WebSocket
 * the server opens (`import WebSocket from "ws"` in
 * @hypothesi/tauri-mcp-server) carries the bridge token header
 * `x-fuutu-bridge-token`, read from `FUUTU_DESKTOP_BRIDGE_TOKEN_FILE` at
 * connect time (the app's launcher creates it). Loaded with `--import`.
 */
import { registerHooks } from "node:module";

const SERVER_PACKAGE = "/@hypothesi/tauri-mcp-server/";
const SHIM = new URL("./ws-token-shim.mjs", import.meta.url).href;

registerHooks({
	resolve(specifier, context, nextResolve) {
		const resolved = nextResolve(specifier, context);
		if (specifier === "ws" && context.parentURL?.includes(SERVER_PACKAGE)) {
			return {
				url: `${SHIM}?ws=${encodeURIComponent(resolved.url)}`,
				shortCircuit: true,
			};
		}
		return resolved;
	},
});
