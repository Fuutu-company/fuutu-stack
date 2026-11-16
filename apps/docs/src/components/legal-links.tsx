import { getTranslations } from "next-intl/server";
import { getLegalLinks } from "@/lib/legal-links";

/**
 * Imprint + privacy links to the marketing site (§ 5 DDG: reachable from
 * every page). Renders nothing while legal pages are off or no marketing
 * URL is configured.
 */
export async function LegalLinks({
	locale,
	className,
}: {
	locale: string;
	className: string;
}) {
	const legal = getLegalLinks(locale);
	if (!legal) return null;
	const t = await getTranslations({ locale, namespace: "legal" });
	return (
		<>
			<a href={legal.imprint} className={className}>
				{t("imprint")}
			</a>
			<a href={legal.privacy} className={className}>
				{t("privacy")}
			</a>
		</>
	);
}
