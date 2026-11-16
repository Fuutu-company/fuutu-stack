import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";

export type PinnedPostResult = { status: number; body: string };

/**
 * Read a response body with a hard byte cap — buffering the full body
 * before truncating would leave worker memory unbounded. Leaving the loop
 * destroys the stream as soon as the cap is hit.
 */
async function readCappedBody(
	res: IncomingMessage,
	maxBytes: number,
): Promise<string> {
	const chunks: Buffer[] = [];
	let total = 0;
	for await (const chunk of res) {
		const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
		const remaining = maxBytes - total;
		if (buf.length >= remaining) {
			chunks.push(buf.subarray(0, remaining));
			break;
		}
		chunks.push(buf);
		total += buf.length;
	}
	return Buffer.concat(chunks).toString("utf8");
}

/**
 * POST through `node:http(s)` with a caller-supplied `lookup`, so the
 * socket connects only to an address that lookup approved (no second,
 * unchecked DNS resolution as with `fetch`). Never follows redirects.
 * `timeoutMs` covers connect, response and body.
 */
export function pinnedPost(
	url: URL,
	init: {
		headers: Record<string, string>;
		body: string;
		lookup: LookupFunction;
		timeoutMs: number;
		maxResponseBytes: number;
	},
): Promise<PinnedPostResult> {
	return new Promise((resolve, reject) => {
		let settled = false;
		const settle = (fn: () => void) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			fn();
		};
		const send = url.protocol === "https:" ? httpsRequest : httpRequest;
		const req = send(
			url,
			{
				method: "POST",
				headers: {
					...init.headers,
					"Content-Length": String(Buffer.byteLength(init.body)),
				},
				lookup: init.lookup,
			},
			(res) => {
				readCappedBody(res, init.maxResponseBytes).then(
					(body) =>
						settle(() => resolve({ status: res.statusCode ?? 0, body })),
					(err: unknown) => settle(() => reject(err)),
				);
			},
		);
		const timer = setTimeout(
			() => req.destroy(new Error("The operation timed out")),
			init.timeoutMs,
		);
		req.on("error", (err) => settle(() => reject(err)));
		req.end(init.body);
	});
}
