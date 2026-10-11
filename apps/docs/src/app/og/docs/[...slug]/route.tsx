import { config } from "@fuutu/config";
import { generate as DefaultImage } from "fumadocs-ui/og";
import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";

import { defaultLocale, locales } from "@/i18n/config";
import { getPageImage, source } from "@/lib/source";

export const revalidate = false;

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ slug: string[] }> },
) {
	const { slug } = await params;
	const rawSlug = slug.slice(0, -1); // drop trailing "image.png"
	const locale =
		rawSlug.length > 0 && (locales as readonly string[]).includes(rawSlug[0])
			? rawSlug[0]
			: defaultLocale;
	const slugs = locale === defaultLocale ? rawSlug : rawSlug.slice(1);
	const page = source.getPage(slugs, locale);
	if (!page) notFound();

	return new ImageResponse(
		<DefaultImage
			title={page.data.title}
			description={page.data.description}
			site={config.app.name}
		/>,
		{
			width: 1200,
			height: 630,
		},
	);
}

export function generateStaticParams() {
	return source.getPages().map((page) => ({
		slug: getPageImage(page).segments,
	}));
}
