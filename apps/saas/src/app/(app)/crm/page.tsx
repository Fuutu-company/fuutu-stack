import { CrmLayout } from "@app/crm";
import { getTranslations } from "next-intl/server";

export default async function CrmPage() {
	const t = await getTranslations("crm");

	return (
		<div className="space-y-4">
			<div>
				<h1 className="font-bold text-3xl">{t("title")}</h1>
				<p className="mt-2 text-muted-foreground">{t("description")}</p>
			</div>
			<CrmLayout />
		</div>
	);
}
