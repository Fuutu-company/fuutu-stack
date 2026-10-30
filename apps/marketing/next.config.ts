import { analyticsCspOrigins } from "@fuutu/analytics";
import {
	KIT_FINGERPRINT_HEADER_NAME,
	KIT_FINGERPRINT_HEADER_VALUE,
} from "@fuutu/config";
import { env } from "@fuutu/env/marketing";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProd = env.NODE_ENV === "production";

// Security headers for the public marketing surface.
// Slightly looser than SaaS: allows the active analytics provider's
// origins and external fonts/images for blog content. Still blocks
// framing and interest-cohort tracking.
const analyticsCsp = analyticsCspOrigins();

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
			`script-src 'self' ${isProd ? "" : "'unsafe-eval'"} 'unsafe-inline' ${analyticsCsp.scriptSrc.join(" ")}`,
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' data: blob: https:",
			"font-src 'self' data: https:",
			`connect-src 'self' https: ${analyticsCsp.connectSrc.join(" ")}`,
			"frame-src https://www.youtube.com https://www.youtube-nocookie.com https://www.openstreetmap.org",
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
	// typedRoutes disabled — marketing uses next-intl's locale-prefixed Link
	// which typedRoutes can't model.
	typedRoutes: false,
	reactCompiler: true,
	transpilePackages: [
		"shiki",
		"@fuutu/ui",
		"@fuutu/i18n",
		"@fuutu/analytics",
		"@fuutu/content",
	],
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					// Kit fingerprint on every marketing response.
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
