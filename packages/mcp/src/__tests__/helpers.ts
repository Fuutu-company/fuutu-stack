type JsonRpcResponse = {
	id?: number;
	result?: Record<string, unknown>;
	error?: { code: number; message: string };
};

const LEGACY_HEADERS = {
	"content-type": "application/json",
	accept: "application/json, text/event-stream",
	"mcp-protocol-version": "2025-11-25",
};

/** Parses a JSON or SSE (`data: {...}`) MCP response body. */
export async function readRpc(res: Response): Promise<JsonRpcResponse> {
	const text = await res.text();
	if ((res.headers.get("content-type") ?? "").includes("text/event-stream")) {
		const data = text
			.split("\n")
			.filter((line) => line.startsWith("data:"))
			.map((line) => line.slice(5).trim())
			.pop();
		return JSON.parse(data ?? "{}") as JsonRpcResponse;
	}
	return JSON.parse(text) as JsonRpcResponse;
}

export function rpcRequest(
	method: string,
	params: Record<string, unknown> = {},
	headers: Record<string, string> = {},
): Request {
	return new Request("http://localhost/api/mcp", {
		method: "POST",
		headers: { ...LEGACY_HEADERS, ...headers },
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
	});
}
