import { getTranslations } from "next-intl/server";
import { ChoosePlan } from "@/modules/app/payments/choose-plan";

export default async function ChoosePlanPage() {
	const t = await getTranslations("payments.choosePlan");
	return (
		<div className="mx-auto max-w-6xl space-y-8">
			<div className="text-center">
				<h1 className="font-bold text-4xl tracking-tight">{t("title")}</h1>
				<p className="mx-auto mt-3 max-w-xl text-muted-foreground">
					{t("description")}
				</p>
			</div>
			<ChoosePlan />
		</div>
	);
}
