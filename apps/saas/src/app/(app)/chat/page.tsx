import { ChatLayout } from "@app/chat";
import { getTranslations } from "next-intl/server";

export default async function ChatPage() {
	const t = await getTranslations("chat");

	return (
		<div className="space-y-4">
			<div>
				<h1 className="font-bold text-3xl">{t("title")}</h1>
				<p className="mt-2 text-muted-foreground">{t("description")}</p>
			</div>
			<ChatLayout />
		</div>
	);
}
