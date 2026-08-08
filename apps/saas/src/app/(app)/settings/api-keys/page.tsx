import { getTranslations } from "next-intl/server";
import { ApiKeyList } from "@/modules/app/api-keys/components/api-key-list";

export default async function UserApiKeysPage() {
	const t = await getTranslations("apiKeys");
	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<div>
				<h1 className="font-bold text-3xl tracking-tight">{t("title")}</h1>
				<p className="mt-2 text-muted-foreground text-sm">{t("description")}</p>
			</div>
			<ApiKeyList />
		</div>
	);
}
