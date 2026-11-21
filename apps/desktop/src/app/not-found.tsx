"use client";

import { AuthCard, Button } from "@fuutu/ui";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { GateScreen } from "@/components/gate-screen";

export default function NotFound() {
	const t = useTranslations("desktop.shell.notFound");
	return (
		<GateScreen>
			<AuthCard title={t("title")}>
				<Button asChild variant="outline">
					<Link href="/">{t("back")}</Link>
				</Button>
			</AuthCard>
		</GateScreen>
	);
}
