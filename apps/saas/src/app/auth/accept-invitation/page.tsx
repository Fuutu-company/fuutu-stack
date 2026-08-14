import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AcceptInvitation } from "@/modules/auth/components/accept-invitation";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("auth.acceptInvitation");
	return {
		title: t("title"),
	};
}

export default function AcceptInvitationPage() {
	return <AcceptInvitation />;
}
