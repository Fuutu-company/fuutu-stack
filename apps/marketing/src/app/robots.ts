import { env } from "@fuutu/env/marketing";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	const base = env.NEXT_PUBLIC_MARKETING_URL ?? "https://fuutustack.com";
	return {
		rules: [{ userAgent: "*", allow: "/" }],
		sitemap: `${base}/sitemap.xml`,
	};
}
