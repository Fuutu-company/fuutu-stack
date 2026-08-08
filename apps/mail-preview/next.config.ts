import type { NextConfig } from "next";

/**
 * Dev-only preview tool for `@fuutu/mail` templates.
 *
 * Transpiles the workspace packages so we can render HTML on the server
 * without publishing or bundling them separately.
 */
const nextConfig: NextConfig = {
	typedRoutes: false,
	transpilePackages: ["@fuutu/mail", "@fuutu/i18n"],
};

export default nextConfig;
