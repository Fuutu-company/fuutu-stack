import { env } from "@fuutu/env/marketing";
import type { MetadataRoute } from "next";
import { appMarketing } from "@/app-marketing";
import { definedFields } from "../lib/page-metadata";

export default function robots(): MetadataRoute.Robots {
	const base = env.NEXT_PUBLIC_MARKETING_URL ?? "https://fuutustack.com";
	const kit: MetadataRoute.Robots = {
		rules: [{ userAgent: "*", allow: "/" }],
		sitemap: `${base}/sitemap.xml`,
	};
	// App rules / sitemap / host (`appMarketing.robots`); unset = the kit's.
	const app = appMarketing.robots;
	if (!app) return kit;
	return typeof app === "function"
		? app(kit)
		: { ...kit, ...definedFields(app) };
}
