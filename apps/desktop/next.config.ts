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
	// Read by scripts/licenses.mjs (licence gate + third-party notices: the
	// exact npm packages in the bundle); build:desktop strips the maps
	// before Tauri bundles `out/`.
	productionBrowserSourceMaps: true,
	reactStrictMode: true,
	transpilePackages: ["@fuutu/ui", "@fuutu/i18n", "@fuutu/utils"],
	devIndicators: false,
};

export default nextConfig;
