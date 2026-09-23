import { defaultLocale } from "@/i18n/config";
import { getLLMText, source } from "@/lib/source";

export const revalidate = false;

export async function GET() {
	// llms.txt convention is a single canonical language — emit the
	// default locale only, otherwise every page appears twice (en+de).
	const scan = source.getPages(defaultLocale).map(getLLMText);
	const scanned = await Promise.all(scan);

	return new Response(scanned.join("\n\n"));
}
