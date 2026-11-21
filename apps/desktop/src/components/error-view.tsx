"use client";

import { Button } from "@fuutu/ui";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { logError } from "@/lib/desktop";

/** Shared body of the error boundaries: logs once, offers a retry. */
export function ErrorView({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	const t = useTranslations("desktop.shell.error");
	useEffect(() => {
		void logError("render error", error);
	}, [error]);
	return (
		<div role="alert" className="flex flex-col items-start gap-3 p-8">
			<h1 className="font-heading font-semibold text-xl">{t("title")}</h1>
			<p className="text-muted-foreground">{t("description")}</p>
			<Button onClick={reset}>{t("retry")}</Button>
		</div>
	);
}
