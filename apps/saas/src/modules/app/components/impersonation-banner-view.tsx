"use client";

import { createLogger } from "@fuutu/logs";
import { Button } from "@fuutu/ui";
import { useMutation } from "@tanstack/react-query";
import { UserRoundCog } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { client } from "@/utils/orpc";

const log = createLogger({ scope: "impersonation-banner" });
const TICK_MS = 15_000;

function minutesLeft(endsAt: number): number {
	return Math.max(0, Math.ceil((endsAt - Date.now()) / 60_000));
}

export function ImpersonationBannerView({
	userId,
	name,
	email,
	endsAt,
}: {
	userId: string;
	name: string;
	email: string;
	endsAt: number;
}) {
	const t = useTranslations("admin.impersonation");
	const [minutes, setMinutes] = useState(() => minutesLeft(endsAt));

	useEffect(() => {
		setMinutes(minutesLeft(endsAt));
		const timer = setInterval(() => setMinutes(minutesLeft(endsAt)), TICK_MS);
		return () => clearInterval(timer);
	}, [endsAt]);

	const stop = useMutation({
		mutationFn: () => client.admin.impersonation.stop(),
		// The admin session cookie is restored: leave via a full navigation.
		onSuccess: () => window.location.assign(`/admin/users/${userId}`),
		onError: (error) => {
			log.error("stop impersonating failed", { err: error });
			toast.error(t("stopError"));
		},
	});

	return (
		<div
			role="status"
			className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-warning px-4 py-2 text-sm text-warning-foreground"
		>
			<UserRoundCog aria-hidden="true" className="size-4 shrink-0" />
			<p className="font-medium">
				{t("message", { name: name || email, email, minutes })}
			</p>
			<Button
				size="sm"
				variant="outline"
				disabled={stop.isPending}
				onClick={() => stop.mutate()}
			>
				{t("stop")}
			</Button>
		</div>
	);
}
