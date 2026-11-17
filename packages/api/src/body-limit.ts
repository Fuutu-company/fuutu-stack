import type { Context, MiddlewareHandler } from "hono";

/**
 * Request body cap — `hono/body-limit` without its `new Request(raw, init)`:
 * under Next.js the incoming request is a wrapper whose private state the
 * constructor cannot read (`TypeError: Cannot read private member
 * #state`), so every body without Content-Length (a body-less DELETE or
 * sign-out, a chunked POST) answered 500. A Content-Length is checked
 * without reading (one that is not plain digits answers 400); otherwise
 * the body is read up to `maxSize` and the request rebuilt from its parts
 * (like `withClientIp`).
 */
export function bodyLimit(options: {
	maxSize: number;
	onError?: (c: Context) => Response | Promise<Response>;
}): MiddlewareHandler {
	const onError =
		options.onError ?? ((c: Context) => c.text("Payload Too Large", 413));
	const { maxSize } = options;
	const handler: MiddlewareHandler = async (c, next) => {
		const raw = c.req.raw;
		if (!raw.body || raw.method === "GET" || raw.method === "HEAD") {
			return next();
		}
		const length = raw.headers.get("content-length");
		// Plain digits only: `parseInt` would read "1e3" as 1 and "abc" as
		// NaN (both under the cap) on a runtime whose parser lets them in.
		if (length !== null && !/^\d+$/.test(length)) {
			return c.text("Bad Request", 400);
		}
		if (length !== null && !raw.headers.has("transfer-encoding")) {
			return Number.parseInt(length, 10) > maxSize ? onError(c) : next();
		}
		const chunks: Uint8Array[] = [];
		let size = 0;
		const reader = raw.body.getReader();
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > maxSize) {
				await reader.cancel().catch(() => {});
				return onError(c);
			}
			chunks.push(value);
		}
		const body = new Uint8Array(size);
		let offset = 0;
		for (const chunk of chunks) {
			body.set(chunk, offset);
			offset += chunk.byteLength;
		}
		c.req.raw = new Request(raw.url, {
			method: raw.method,
			headers: new Headers(raw.headers),
			signal: raw.signal,
			...(size > 0 ? { body } : {}),
		});
		return next();
	};
	// The route registry test recognizes body limits by this name.
	Object.defineProperty(handler, "name", { value: "bodyLimit" });
	return handler;
}
