"use client";

import { AuthCard, Button } from "@fuutu/ui";
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
		<div role="alert" className="mx-auto w-full max-w-md py-10">
			<AuthCard title={t("title")} description={t("description")}>
				<Button onClick={reset}>{t("retry")}</Button>
			</AuthCard>
		</div>
	);
}
