import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { bodyLimit as honoBodyLimit } from "hono/body-limit";
import { describe, expect, it } from "vitest";
import { bodyLimit } from "../body-limit";

/**
 * Under Next.js the request Hono gets is a wrapper whose private Request
 * state the constructor cannot read: `new Request(wrapper, init)` — what
 * hono/body-limit does for a body without Content-Length — throws
 * "Cannot read private member #state" (500 on a body-less DELETE, a
 * body-less sign-out, any chunked POST). A Proxy over a real Request fails
 * the same way.
 */
const nextLike = (request: Request): Request =>
	new Proxy(request, {
		get(target, prop) {
			const value = Reflect.get(target, prop, target);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});

const stream = (...chunks: string[]) =>
	new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(new TextEncoder().encode(chunk));
			}
			controller.close();
		},
	});

/** A request whose body is a stream without Content-Length (chunked). */
const chunked = (method: string, ...chunks: string[]) =>
	nextLike(
		new Request("http://localhost:3000/api/x", {
			method,
			body: stream(...chunks),
			duplex: "half",
		} as RequestInit),
	);

const appWith = (limit: typeof bodyLimit | typeof honoBodyLimit) =>
	new Hono()
		.use(
			"*",
			limit({
				maxSize: 10,
				onError: (c) => c.json({ error: "too_large" }, 413),
			}),
		)
		.all("/api/x", async (c) =>
			c.json({ method: c.req.method, body: await c.req.text() }),
		);

describe("kit bodyLimit under a Next-like request wrapper", () => {
	it("hono/body-limit fails on it (why the kit has its own)", async () => {
		const res = await appWith(honoBodyLimit).fetch(chunked("DELETE"));
		expect(res.status).toBe(500);
	});

	it.each(["DELETE", "POST"])("passes a %s without a body", async (method) => {
		const res = await appWith(bodyLimit).fetch(chunked(method));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ method, body: "" });
	});

	it("passes a chunked POST under the limit, body intact", async () => {
		const res = await appWith(bodyLimit).fetch(chunked("POST", "abc", "def"));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ method: "POST", body: "abcdef" });
	});

	it("refuses a chunked POST over the limit", async () => {
		const res = await appWith(bodyLimit).fetch(
			chunked("POST", "abcdef", "ghijkl"),
		);
		expect(res.status).toBe(413);
	});

	it("refuses by Content-Length without reading the body", async () => {
		const res = await appWith(bodyLimit).fetch(
			nextLike(
				new Request("http://localhost:3000/api/x", {
					method: "POST",
					headers: { "content-length": "11" },
					body: "x".repeat(11),
				}),
			),
		);
		expect(res.status).toBe(413);
	});

	it("passes a body within its Content-Length", async () => {
		const res = await appWith(bodyLimit).fetch(
			nextLike(
				new Request("http://localhost:3000/api/x", {
					method: "POST",
					body: "hello",
				}),
			),
		);
		expect(await res.json()).toEqual({ method: "POST", body: "hello" });
	});

	it("passes a GET", async () => {
		const res = await appWith(bodyLimit).fetch(
			nextLike(new Request("http://localhost:3000/api/x")),
		);
		expect(res.status).toBe(200);
	});

	it("is the body limit the API app uses", () => {
		const app = readFileSync(join(import.meta.dirname, "../app.ts"), "utf8");
		expect(app).not.toContain("hono/body-limit");
		expect(app).toContain('from "./body-limit"');
	});

	it("is detectable as a body limit by the route registry", () => {
		expect(bodyLimit({ maxSize: 1 }).name).toBe("bodyLimit");
	});
});
