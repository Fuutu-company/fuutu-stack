"use client";

import { Button } from "@fuutu/ui";
import { useTranslations } from "next-intl";

export default function ErrorBoundary({
	reset,
}: {
	error: Error;
	reset: () => void;
}) {
	const t = useTranslations("common.errors");
	return (
		<div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
			<p className="text-muted-foreground">{t("somethingWentWrong")}</p>
			<Button onClick={reset}>{t("retry")}</Button>
		</div>
	);
}
