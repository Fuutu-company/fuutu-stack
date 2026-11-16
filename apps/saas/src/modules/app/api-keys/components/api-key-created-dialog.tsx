"use client";

import { SecretRevealDialog } from "@fuutu/ui";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export function ApiKeyCreatedDialog({
	apiKey,
	open,
	onClose,
	hint,
}: {
	apiKey: string | null;
	open: boolean;
	onClose: () => void;
	/** Next step shown under the key, e.g. where to store it. */
	hint?: ReactNode;
}) {
	const t = useTranslations("apiKeys.createdDialog");
	const tCommon = useTranslations("common");

	return (
		<SecretRevealDialog
			open={open}
			secret={apiKey}
			onClose={onClose}
			title={t("title")}
			description={t("description")}
			labels={{
				copy: t("copy"),
				copied: t("copied"),
				copyFailed: t("copyFailed"),
				done: t("done"),
				close: tCommon("close"),
			}}
		>
			{hint}
		</SecretRevealDialog>
	);
}
