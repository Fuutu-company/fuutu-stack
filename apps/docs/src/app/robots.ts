import { env } from "@fuutu/env/docs";
import type { MetadataRoute } from "next";
import { appDocs } from "@/app-docs";

export default function robots(): MetadataRoute.Robots {
	const base = env.NEXT_PUBLIC_DOCS_URL ?? "http://localhost:4000";
	const kit: MetadataRoute.Robots = {
		rules: [{ userAgent: "*", allow: "/" }],
		sitemap: `${base}/sitemap.xml`,
	};
	// App rules / sitemap / host (`appDocs.robots`); unset = the kit's.
	const app = appDocs.robots;
	if (!app) return kit;
	if (typeof app === "function") return app(kit);
	const fields = Object.fromEntries(
		Object.entries(app).filter(([, value]) => value !== undefined),
	);
	return { ...kit, ...fields };
}
