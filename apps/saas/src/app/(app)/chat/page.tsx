import { ChatLayout } from "@app/chat";
import { PageHeader } from "@fuutu/ui";
import { getTranslations } from "next-intl/server";

export default async function ChatPage() {
	const t = await getTranslations("chat");

	return (
		<div className="space-y-4">
			<PageHeader variant="compact" title={t("title")} />
			<ChatLayout />
		</div>
	);
}
