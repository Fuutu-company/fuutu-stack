import { env } from "@fuutu/env/docs";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	const base = env.NEXT_PUBLIC_DOCS_URL ?? "http://localhost:4000";
	return {
		rules: [{ userAgent: "*", allow: "/" }],
		sitemap: `${base}/sitemap.xml`,
	};
}
