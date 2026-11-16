"use client";

import { authClient } from "@fuutu/auth/client";
import { createLogger } from "@fuutu/logs";
import { Alert, AlertDescription, AlertTitle, Button } from "@fuutu/ui";
import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

const log = createLogger({ scope: "verify-email-for-invitations" });

type SendState = "idle" | "sending" | "sent" | "failed";

/**
 * Invitations are listed and accepted only with a verified email (anyone
 * can sign up with an invited address). Shown to unverified users where
 * invitations would appear, with a resend of the verification email that
 * returns them to `callbackPath`.
 */
export function VerifyEmailForInvitations({
	email,
	callbackPath,
}: {
	email: string;
	callbackPath: string;
}) {
	const t = useTranslations("auth.verifyEmailForInvitations");
	const [state, setState] = useState<SendState>("idle");

	async function send() {
		setState("sending");
		try {
			const res = await authClient.sendVerificationEmail({
				email,
				callbackURL: callbackPath,
			});
			setState(res.error ? "failed" : "sent");
		} catch (e) {
			log.error("verification email request failed", { err: e });
			setState("failed");
		}
	}

	return (
		<Alert role="status">
			<MailCheck />
			<AlertTitle>{t("title")}</AlertTitle>
			<AlertDescription className="space-y-3">
				<p className="text-muted-foreground">{t("description", { email })}</p>
				{state === "sent" ? (
					<p>{t("sent", { email })}</p>
				) : (
					<Button
						size="sm"
						variant="outline"
						onClick={send}
						disabled={state === "sending"}
					>
						{state === "sending" ? t("sending") : t("send")}
					</Button>
				)}
				{state === "failed" && (
					<p className="text-destructive">{t("failed")}</p>
				)}
			</AlertDescription>
		</Alert>
	);
}
