"use client";

import { Button, type Toaster } from "@fuutu/ui";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { toast } from "sonner";

/** The app's root layout already mounts the `Toaster`; this page only fires toasts. */
const POSITION: ComponentProps<typeof Toaster>["position"] = "bottom-right";

export function ToastDemo() {
	const t = useTranslations("designSystem.components.overlays.toast");

	return (
		<div className="flex flex-wrap gap-2">
			<Button
				variant="outline"
				onClick={() =>
					toast(t("default.title"), {
						description: t("default.description"),
						position: POSITION,
					})
				}
			>
				{t("default.trigger")}
			</Button>
			<Button
				variant="outline"
				onClick={() =>
					toast.success(t("success.title"), { position: POSITION })
				}
			>
				{t("success.trigger")}
			</Button>
			<Button
				variant="outline"
				onClick={() => toast.error(t("error.title"), { position: POSITION })}
			>
				{t("error.trigger")}
			</Button>
		</div>
	);
}
