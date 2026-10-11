import { notFound } from "next/navigation";

import { getLLMText, source } from "@/lib/source";

export const revalidate = false;

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ locale: string; slug?: string[] }> },
) {
	const { locale, slug } = await params;
	const page = source.getPage(slug, locale);
	if (!page) notFound();

	return new Response(await getLLMText(page), {
		headers: {
			"Content-Type": "text/markdown",
		},
	});
}

export function generateStaticParams() {
	return source.generateParams("slug", "locale");
}
