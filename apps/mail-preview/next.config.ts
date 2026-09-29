import {
	KIT_FINGERPRINT_HEADER_NAME,
	KIT_FINGERPRINT_HEADER_VALUE,
} from "@fuutu/config";
import type { NextConfig } from "next";

/**
 * Dev-only preview tool for `@fuutu/mail` templates.
 *
 * Transpiles the workspace packages so we can render HTML on the server
 * without publishing or bundling them separately.
 */
const nextConfig: NextConfig = {
	typedRoutes: false,
	transpilePackages: ["@fuutu/mail", "@fuutu/i18n", "@fuutu/config"],
	// Kit fingerprint header — every HTTP surface mirrors it
	// (license-telemetry rule), including dev tools.
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{
						key: KIT_FINGERPRINT_HEADER_NAME,
						value: KIT_FINGERPRINT_HEADER_VALUE,
					},
				],
			},
		];
	},
};

export default nextConfig;
