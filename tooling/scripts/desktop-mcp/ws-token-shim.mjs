/**
 * `ws` as seen by the desktop automation MCP server (see ws-token-hook.mjs):
 * the real `WebSocket` class with the bridge token header added.
 */
import { readFileSync } from "node:fs";

const realUrl = new URL(import.meta.url).searchParams.get("ws");
const real = await import(realUrl);
const RealWebSocket = real.default;

export const TOKEN_HEADER = "x-fuutu-bridge-token";

/** The current bridge token, or "" when the app has never been started. */
export function readBridgeToken(
	file = process.env.FUUTU_DESKTOP_BRIDGE_TOKEN_FILE,
) {
	if (!file) return "";
	try {
		return JSON.parse(readFileSync(file, "utf8")).token ?? "";
	} catch {
		return "";
	}
}

class TokenWebSocket extends RealWebSocket {
	constructor(address, protocols, options) {
		// ws accepts (address, options) as well as (address, protocols, options).
		const optionsFirst =
			protocols && typeof protocols === "object" && !Array.isArray(protocols);
		const opts = (optionsFirst ? protocols : options) ?? {};
		const withToken = {
			...opts,
			headers: { ...opts.headers, [TOKEN_HEADER]: readBridgeToken() },
		};
		if (optionsFirst) super(address, withToken);
		else super(address, protocols, withToken);
	}
}

export default TokenWebSocket;
export const WebSocket = TokenWebSocket;
export const WebSocketServer = real.WebSocketServer;
export const createWebSocketStream = real.createWebSocketStream;
