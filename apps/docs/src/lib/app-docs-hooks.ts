import { appDocsSource } from "../../app-docs-source";
import { docsContentDir } from "./docs-source-config";

/**
 * Kit side of `appDocs.sourceUrl` / `appDocs.processMarkdown` /
 * `appDocs.ogImage.url` (`src/app-docs.tsx`). Generic over the page so it stays free of the
 * fumadocs loader; unset hooks reproduce the kit behaviour.
 */

const KIT_REPO = "https://github.com/Fuutu-company/fuutu-stack/blob/main";

/**
 * "Open in GitHub" target: kit GitHub URL of the page file (under the
 * content dir), the app's URL, or `null` = no link. Generated OpenAPI
 * pages have no content file: no kit link.
 */
export function resolveSourceUrl<Page extends { path: string; type?: string }>(
	page: Page,
	sourceUrl: ((page: Page) => string | null) | null | undefined,
): string | null {
	if (sourceUrl === null) return null;
	if (sourceUrl) return sourceUrl(page);
	if (page.type === "openapi") return null;
	return `${KIT_REPO}/apps/docs/${docsContentDir(appDocsSource)}/${page.path}`;
}

/** The page Markdown, run through the app hook when one is set. */
export async function processMarkdown<Page>(
	markdown: string,
	page: Page,
	hook:
		| ((markdown: string, page: Page) => string | Promise<string>)
		| undefined,
): Promise<string> {
	return hook ? await hook(markdown, page) : markdown;
}

/** OG image URL of a page: the kit's `/og/docs/…` route, or the app's. */
export function resolveOgImageUrl<Page>(
	page: Page,
	kitUrl: string,
	hook: ((page: Page) => string) | undefined,
): string {
	return hook ? hook(page) : kitUrl;
}

/**
 * Fonts for the OG image (`appDocs.ogImage.fonts`): a list, or a loader
 * called per image request (read font files lazily). Unset: none — the
 * `next/og` default font.
 */
export async function resolveOgFonts<Font>(
	fonts:
		| readonly Font[]
		| (() => readonly Font[] | Promise<readonly Font[]>)
		| undefined,
): Promise<Font[] | undefined> {
	if (!fonts) return undefined;
	return [...(typeof fonts === "function" ? await fonts() : fonts)];
}
