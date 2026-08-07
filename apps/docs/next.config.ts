import "@fuutu/env/docs";
import {
	KIT_FINGERPRINT_HEADER_NAME,
	KIT_FINGERPRINT_HEADER_VALUE,
} from "@fuutu/config";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const withMDX = createMDX();

const isProd = process.env.NODE_ENV === "production";

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
			`script-src 'self' ${isProd ? "" : "'unsafe-eval'"} 'unsafe-inline'`,
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' data: blob: https:",
			"font-src 'self' data: https:",
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
	typedRoutes: false,
	reactCompiler: true,
	transpilePackages: ["shiki", "@fuutu/ui", "@fuutu/i18n"],
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{
						key: KIT_FINGERPRINT_HEADER_NAME,
						value: KIT_FINGERPRINT_HEADER_VALUE,
					},
					...securityHeaders,
				],
			},
		];
	},
	async rewrites() {
		return [
			{
				source: "/docs/:path*.mdx",
				destination: "/llms.mdx/docs/:path*",
			},
		];
	},
};

export default withMDX(withNextIntl(nextConfig));
