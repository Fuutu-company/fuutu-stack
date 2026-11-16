"use client";

import { cn } from "@fuutu/utils/cn";
import { useTranslations } from "next-intl";

/** Why an action is disabled while support impersonates the user. */
export function ImpersonationNotice({
	id,
	className,
}: {
	id?: string;
	className?: string;
}) {
	const t = useTranslations("common.errors");
	return (
		<p
			id={id}
			className={cn(
				"rounded-md bg-muted p-3 text-muted-foreground text-sm",
				className,
			)}
		>
			{t("impersonationForbidden")}
		</p>
	);
}
