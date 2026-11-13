import { PageHeader } from "@fuutu/ui";
import { getTranslations } from "next-intl/server";
import { ChoosePlan } from "@/modules/app/payments/choose-plan";

export default async function ChoosePlanPage() {
	const t = await getTranslations("payments.choosePlan");
	return (
		<div className="mx-auto max-w-6xl space-y-8">
			<PageHeader variant="compact" title={t("title")} />
			<ChoosePlan />
		</div>
	);
}
