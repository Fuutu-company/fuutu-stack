import { config } from "@fuutu/config";
import { env } from "@fuutu/env/saas";
import { i18nConfig } from "@fuutu/i18n/config";
import { legalLinks } from "@fuutu/utils/legal-links";

/** Marketing legal-page URLs for this locale; `null` when switched off or unconfigured. */
export function getLegalLinks(locale: string) {
	return legalLinks({
		marketingUrl: env.NEXT_PUBLIC_MARKETING_URL,
		locale,
		defaultLocale: i18nConfig.defaultLocale,
		enabled: config.features.legalPages,
	});
}
