"use client";

import { useTranslations } from "next-intl";
import {
	FEATURES,
	FeatureHero,
	FeatureRow,
	FeatureShowcase,
} from "../../features";

export function Features() {
	const t = useTranslations("home.features");

	return (
		<div id="features" className="scroll-mt-24">
			<FeatureHero
				item={FEATURES[0]}
				heading={t("hero.heading")}
				subheading={t("hero.subheading")}
			/>
			<FeatureRow
				items={[FEATURES[1], FEATURES[2], FEATURES[3]]}
				heading={t("row.heading")}
			/>
			<FeatureShowcase
				items={FEATURES.slice(4)}
				heading={t("showcase.heading")}
				subheading={t("showcase.subheading")}
			/>
		</div>
	);
}
