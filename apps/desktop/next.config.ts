import type { NextConfig } from "next";

/**
 * The desktop frontend is a static export loaded by Tauri from the app
 * bundle — no Next server at runtime, so no route handlers, server actions,
 * proxy.ts or response headers (see security-headers.test.ts, NO_HTTP_APPS).
 * `trailingSlash` emits `route/index.html`, which Tauri's asset protocol
 * resolves on a hard reload of a nested route.
 */
const nextConfig: NextConfig = {
	output: "export",
	trailingSlash: true,
	images: { unoptimized: true },
	reactStrictMode: true,
	transpilePackages: ["@fuutu/ui", "@fuutu/i18n", "@fuutu/utils"],
	devIndicators: false,
};

export default nextConfig;
