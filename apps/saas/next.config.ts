import { fileURLToPath } from "node:url";
import { analyticsCspOrigins } from "@fuutu/analytics";
import {
	KIT_FINGERPRINT_HEADER_NAME,
	KIT_FINGERPRINT_HEADER_VALUE,
} from "@fuutu/config";
import { env } from "@fuutu/env/saas";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProd = env.NODE_ENV === "production";
// Only for an https deployment: on a production build served over plain
// http (local `next start`, E2E/visual containers) WebKit would upgrade —
// and so drop — every CSS/JS request.
const servedOverHttps =
	isProd &&
	Boolean(
		(env.NEXT_PUBLIC_SAAS_URL ?? env.BETTER_AUTH_URL)?.startsWith("https://"),
	);

// Analytics CSP origins come from the active provider — switching
// providers via NEXT_PUBLIC_ANALYTICS_PROVIDER needs no edits here.
const analyticsCsp = analyticsCspOrigins();

// Presigned uploads PUT directly from the browser to the storage
// endpoint — allow its origin in connect-src. Matters for http://
// endpoints like local MinIO (https endpoints are covered by `https:`).
// Non-http(s) or malformed endpoints are ignored: the CSP stays strict
// and boot never crashes when env validation is skipped.
let storageConnectSrc = "";
try {
	const url = new URL(env.S3_ENDPOINT ?? "");
	if (url.protocol === "http:" || url.protocol === "https:") {
		storageConnectSrc = url.origin;
	}
} catch {
	// invalid endpoint → CSP stays strict, uploads degrade
}

// Security headers applied to every SaaS response.
// Known CSP compromise: `'unsafe-inline'` stays on `script-src` in every env
// because next-themes + the React Compiler emit a small inline bootstrap
// script on first paint. Production additionally drops `'unsafe-eval'`.
// The clean follow-up is a nonce-based allow-list — tracked for v1.1.
// `'unsafe-inline'` on `style-src` covers Tailwind's runtime style islands.
const securityHeaders = [
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{
		key: "Permissions-Policy",
		value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
	},
	{ key: "Cross-Origin-Opener-Policy", value: "same-origin" },
	{ key: "Cross-Origin-Resource-Policy", value: "same-site" },
	...(isProd
		? [
				{
					key: "Strict-Transport-Security",
					value: "max-age=63072000; includeSubDomains; preload",
				},
			]
		: []),
];

// Every path except /api/docs: that page sends its own sandboxed CSP
// (`@fuutu/api` api-docs.ts) — a route header cannot replace this one.
const contentSecurityPolicy = {
	key: "Content-Security-Policy",
	value: [
		"default-src 'self'",
		// React Compiler + next-themes inline script on first paint.
		`script-src 'self' ${isProd ? "" : "'unsafe-eval'"} 'unsafe-inline' ${analyticsCsp.scriptSrc.join(" ")}`,
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob: https:",
		"font-src 'self' data:",
		`connect-src 'self' https: ${storageConnectSrc} ${analyticsCsp.connectSrc.join(" ")}`,
		"frame-ancestors 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"object-src 'none'",
		...(servedOverHttps ? ["upgrade-insecure-requests"] : []),
	].join("; "),
};

const nextConfig: NextConfig = {
	// typedRoutes disabled until cross-app links (to marketing) are wired
	// through NEXT_PUBLIC_MARKETING_URL.
	typedRoutes: false,
	reactCompiler: true,
	// E2E builds (tooling/scripts/next.mjs) write to their own dir so the
	// running dev server's `.next` stays intact.
	distDir: process.env.NEXT_DIST_DIR ?? ".next",
	// Self-hosting (Docker/Coolify): standalone server traced from the repo
	// root so workspace packages (packages/*) land in .next/standalone.
	output: "standalone",
	outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
	transpilePackages: ["shiki", "@fuutu/ui", "@fuutu/i18n", "@fuutu/analytics"],
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					// Kit fingerprint on every page/asset response. The
					// Hono middleware in `@fuutu/api` covers `/api/*`; this
					// covers the rest.
					{
						key: KIT_FINGERPRINT_HEADER_NAME,
						value: KIT_FINGERPRINT_HEADER_VALUE,
					},
					...securityHeaders,
				],
			},
			{
				source: "/:path((?!api/docs$).*)",
				headers: [contentSecurityPolicy],
			},
		];
	},
};

export default withNextIntl(nextConfig);
