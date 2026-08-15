import { auth } from "@fuutu/auth";
import {
	KIT_FINGERPRINT_HEADER_NAME,
	KIT_FINGERPRINT_HEADER_VALUE,
	KIT_NAME,
	KIT_VERSION,
} from "@fuutu/config";
import { env } from "@fuutu/env/saas";
import { checkLicense } from "@fuutu/license";
import { createLogger } from "@fuutu/logs";
import { handlePaymentsWebhook } from "@fuutu/payments";
import { pingTelemetry } from "@fuutu/telemetry";
import { Hono, type Context as HonoContext } from "hono";
import { cors } from "hono/cors";
import { createContext } from "./context";
import { openApiHandler, rpcHandler } from "./orpc/handler";

const log = createLogger({ scope: "api" });

const docsHandler = async (c: HonoContext) => {
	const { matched, response } = await openApiHandler.handle(c.req.raw, {
		prefix: "/api",
		context: { session: null, headers: c.req.raw.headers as Headers },
	});
	if (matched) {
		return c.newResponse(response.body, response);
	}
	return c.notFound();
};

// Boot-time license cache warm-up. Fire-and-forget so import time is
// not blocked on the network. `checkLicense()` is fail-soft (5 s timeout,
// always resolves to a `LicenseStatus`) and populates the in-memory
// cache that `getLicenseMode()` reads on hot paths. Without this call
// the kit reports `mode="oss"` even with a valid Enterprise key.
// See LICENSE.md §7.
void checkLicense();

// Boot-time telemetry ping. Fire-and-forget so import time is
// not blocked on the network. `pingTelemetry()` is fail-soft (5 s timeout,
// always resolves to a `PingResult`) and sends a non-blocking POST to the
// telemetry endpoint with kit identity and license fingerprint.
void pingTelemetry();

export const app = new Hono()
	.basePath("/api")
	.use("*", async (c, next) => {
		const start = performance.now();
		await next();
		const { method } = c.req;
		const path = c.req.path;
		const status = c.res.status;
		const duration = Math.round(performance.now() - start);
		log.info("request", { method, path, status, duration });
	})
	// Surface the kit fingerprint on every API response so ops,
	// support and license-compliance tooling can verify the running kit
	// without parsing internal endpoints. Removing this header is a
	// license violation (LICENSE.md §7).
	.use("*", async (c, next) => {
		await next();
		c.res.headers.set(
			KIT_FINGERPRINT_HEADER_NAME,
			KIT_FINGERPRINT_HEADER_VALUE,
		);
	})
	.use(
		"*",
		cors({
			origin: env.CORS_ORIGIN,
			allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			allowHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		}),
	)
	.on(["POST", "GET"], "/auth/**", (c) => auth.handler(c.req.raw))
	.get("/health", (c) => c.json({ status: "healthy" }))
	.get("/version", (c) =>
		c.json({
			name: KIT_NAME,
			version: KIT_VERSION,
		}),
	)
	// Mounted **before** createContext middleware: payment providers sign
	// the raw request body and verify via shared secret — there is no
	// session to gate on. Do not move this below the `.use("*", createContext)`
	// line or signature verification will break.
	// BYPASS: provider HMAC signature over raw body — mounted before contextMiddleware, do not move
	.all("/webhooks/payments", (c) => handlePaymentsWebhook(c.req.raw))
	// OpenAPI docs + spec: served before createContext so they render without a DB
	// connection. The Scalar UI and spec are public — procedure-level auth still
	// applies to actual API endpoints.
	.get("/docs", docsHandler)
	.get("/spec.json", docsHandler)
	.use("*", async (c, next) => {
		const context = await createContext({ context: c });
		const isRpc = c.req.path.includes("/rpc/");
		const handler = isRpc ? rpcHandler : openApiHandler;
		const prefix = isRpc ? "/api/rpc" : "/api";

		const { matched, response } = await handler.handle(c.req.raw, {
			prefix,
			context,
		});

		if (matched) {
			return c.newResponse(response.body, response);
		}

		await next();
	});

export type App = typeof app;
