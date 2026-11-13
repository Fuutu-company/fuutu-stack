import {
	ComponentMatrix,
	DESIGN_SECTIONS,
	DesignHeader,
	DesignSection,
	DoDont,
	ExampleScreen,
	Foundations,
	Patterns,
	richCode,
} from "@app/design-system";
import { config } from "@fuutu/config";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

export default async function DesignPage() {
	if (!config.features.designSystem) notFound();
	const t = await getTranslations("designSystem");

	const content: Partial<Record<string, ReactNode>> = {
		foundations: <Foundations />,
		components: <ComponentMatrix />,
		patterns: <Patterns />,
		"do-dont": <DoDont />,
		example: <ExampleScreen />,
	};

	return (
		<div className="mx-auto max-w-6xl space-y-10">
			<DesignHeader />
			{DESIGN_SECTIONS.map(({ id, key }, index) => (
				<DesignSection
					key={id}
					id={id}
					index={index + 1}
					title={t(`sections.${key}.title`)}
					description={t.rich(`sections.${key}.description`, richCode)}
				>
					{content[id]}
				</DesignSection>
			))}
		</div>
	);
}
