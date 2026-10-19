import { timingSafeEqual } from "node:crypto";
import { auth } from "@fuutu/auth";
import {
	KIT_FINGERPRINT_HEADER_NAME,
	KIT_FINGERPRINT_HEADER_VALUE,
	KIT_NAME,
	KIT_VERSION,
} from "@fuutu/config";
import { runAllJobs, runJob } from "@fuutu/cron";
import { env } from "@fuutu/env/saas";
import { checkLicense, getLicenseMode } from "@fuutu/license";
import { createLogger } from "@fuutu/logs";
import { handlePaymentsWebhook } from "@fuutu/payments";
import { pingTelemetry } from "@fuutu/telemetry";
import { Hono, type Context as HonoContext } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { createContext } from "./context";
import { openApiHandler, rpcHandler } from "./orpc/handler";

const log = createLogger({ scope: "api" });

const docsHandler = async (c: HonoContext) => {
	const { matched, response } = await openApiHandler.handle(c.req.raw, {
		prefix: "/api",
		context: {
			session: null,
			headers: c.req.raw.headers as Headers,
			apiKey: null,
		},
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
	// CSRF guard for mutating requests — defense in depth on top of
	// SameSite=Lax cookies. Browsers always send `Origin` on cross-site
	// posts; when present it must match this host or the configured
	// CORS_ORIGIN. Requests without an Origin (server-to-server webhooks,
	// cron triggers, API-key clients) carry no ambient cookies and pass.
	.use("*", async (c, next) => {
		const method = c.req.method;
		if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
			return next();
		}
		const origin = c.req.header("origin");
		if (!origin) {
			return next();
		}
		try {
			const originHost = new URL(origin).host;
			const allowed = new Set([new URL(c.req.url).host]);
			if (env.CORS_ORIGIN) {
				allowed.add(new URL(env.CORS_ORIGIN).host);
			}
			if (!allowed.has(originHost)) {
				return c.json({ error: "forbidden_origin" }, 403);
			}
		} catch {
			return c.json({ error: "forbidden_origin" }, 403);
		}
		return next();
	})
	.on(["POST", "GET"], "/auth/**", (c) => auth.handler(c.req.raw))
	.get("/health", (c) => c.json({ status: "healthy" }))
	.get("/version", (c) =>
		c.json({
			name: KIT_NAME,
			version: KIT_VERSION,
			// License-mode reporting surface (LICENSE.md §6(5)) — reads the
			// cache warmed by the boot-time checkLicense(), never blocks.
			licenseMode: getLicenseMode(),
		}),
	)
	// Mounted **before** createContext middleware: payment providers sign
	// the raw request body and verify via shared secret — there is no
	// session to gate on. Do not move this below the `.use("*", createContext)`
	// line or signature verification will break.
	// BYPASS: provider HMAC signature over raw body — mounted before contextMiddleware, do not move
	.all("/webhooks/payments", (c) => handlePaymentsWebhook(c.req.raw))
	// Cron trigger — mounted before createContext: external schedulers
	// (Vercel Cron, cron-job.org, GitHub Actions) authenticate via
	// `Authorization: Bearer ${CRON_SECRET}`, not a session cookie.
	// When CRON_SECRET is unset the endpoint answers 501 so a missing
	// secret can never silently open an unauthenticated trigger.
	// BYPASS: shared-secret bearer auth — do not move below contextMiddleware
	.on(["GET", "POST"], "/cron", async (c) => {
		const secret = env.CRON_SECRET;
		if (!secret) {
			return c.json({ error: "cron_not_configured" }, 501);
		}
		const header = c.req.header("authorization") ?? "";
		const expected = `Bearer ${secret}`;
		const ok =
			header.length === expected.length &&
			timingSafeEqual(Buffer.from(header), Buffer.from(expected));
		if (!ok) {
			return c.json({ error: "unauthorized" }, 401);
		}
		// `?job=<name>` force-runs a single job regardless of its schedule;
		// without it all due jobs run.
		const jobName = c.req.query("job");
		if (jobName) {
			const result = await runJob(jobName);
			return c.json({ ok: result.success, result });
		}
		const results = await runAllJobs();
		return c.json({ ok: true, results });
	})
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
	})
	// Thrown exceptions (createContext, auth.handler, webhook/cron handlers)
	// bypass the `.use("*")` fingerprint middleware — the header is set on the
	// error response here too so emission point 1 covers every /api/* response.
	.onError((err, c) => {
		log.error("unhandled error", {
			err,
			method: c.req.method,
			path: c.req.path,
		});
		// Preserve Hono's HTTPException semantics (intended status codes)
		// instead of flattening everything to a generic 500.
		const res =
			err instanceof HTTPException
				? err.getResponse()
				: c.json({ error: "internal_error" }, 500);
		res.headers.set(KIT_FINGERPRINT_HEADER_NAME, KIT_FINGERPRINT_HEADER_VALUE);
		return res;
	});

export type App = typeof app;
