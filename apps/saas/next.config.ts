import "@fuutu/env/saas";
import {
	KIT_FINGERPRINT_HEADER_NAME,
	KIT_FINGERPRINT_HEADER_VALUE,
} from "@fuutu/config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProd = process.env.NODE_ENV === "production";

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
		value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
	},
	{ key: "X-DNS-Prefetch-Control", value: "on" },
	{
		key: "Content-Security-Policy",
		value: [
			"default-src 'self'",
			// React Compiler + next-themes inline script on first paint.
			// Scalar CDN for OpenAPI docs at /api/docs.
			`script-src 'self' ${isProd ? "" : "'unsafe-eval'"} 'unsafe-inline' https://cdn.jsdelivr.net`,
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' data: blob: https:",
			"font-src 'self' data: https://fonts.scalar.com",
			"connect-src 'self' https:",
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'",
			"object-src 'none'",
		].join("; "),
	},
	...(isProd
		? [
				{
					key: "Strict-Transport-Security",
					value: "max-age=63072000; includeSubDomains; preload",
				},
			]
		: []),
];

const nextConfig: NextConfig = {
	// typedRoutes disabled until cross-app links (to marketing) are wired
	// through NEXT_PUBLIC_MARKETING_URL.
	typedRoutes: false,
	reactCompiler: true,
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
		];
	},
};

export default withNextIntl(nextConfig);
