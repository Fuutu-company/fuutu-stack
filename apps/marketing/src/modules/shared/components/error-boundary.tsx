"use client";

import { Button } from "@fuutu/ui";
import { useTranslations } from "next-intl";

type ErrorBoundaryProps = {
	error?: Error;
	reset: () => void;
};

export function ErrorBoundary({ reset }: ErrorBoundaryProps) {
	const t = useTranslations("common.errors");
	// Error is caught by Next.js error boundary mechanism; no client-side logging needed.

	return (
		<div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
			<p className="text-muted-foreground">{t("somethingWentWrong")}</p>
			<Button onClick={reset}>{t("retry")}</Button>
		</div>
	);
}
