import type { MetadataRoute } from "next";

/**
 * The signed-in app has nothing for search engines: keep every route out of
 * the index. Marketing and docs ship their own robots.txt.
 */
export default function robots(): MetadataRoute.Robots {
	return { rules: { userAgent: "*", disallow: "/" } };
}
