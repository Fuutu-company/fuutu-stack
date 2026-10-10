"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Surfaces server-side auth redirects (`?error=forbidden`) as a toast.
 * Mounted once in the app layout; fires a single toast per param value.
 */
export function ErrorToast() {
	const t = useTranslations();
	const searchParams = useSearchParams();
	const shown = useRef<string | null>(null);
	const error = searchParams.get("error");

	useEffect(() => {
		if (!error || shown.current === error) return;
		shown.current = error;
		if (error === "forbidden") {
			toast.error(t("common.errors.forbidden"));
		}
	}, [error, t]);

	return null;
}
