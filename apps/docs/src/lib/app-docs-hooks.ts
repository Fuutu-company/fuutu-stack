import { appDocsSource } from "../../app-docs-source";
import { docsContentDir } from "./docs-source-config";

/**
 * Kit side of `appDocs.sourceUrl` / `appDocs.processMarkdown`
 * (`src/app-docs.tsx`). Generic over the page so it stays free of the
 * fumadocs loader; unset hooks reproduce the kit behaviour.
 */

const KIT_REPO = "https://github.com/Fuutu-company/fuutu-stack/blob/main";

/**
 * "Open in GitHub" target: kit GitHub URL of the page file (under the
 * content dir), the app's URL, or `null` = no link.
 */
export function resolveSourceUrl<Page extends { path: string }>(
	page: Page,
	sourceUrl: ((page: Page) => string | null) | null | undefined,
): string | null {
	if (sourceUrl === null) return null;
	if (sourceUrl) return sourceUrl(page);
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
