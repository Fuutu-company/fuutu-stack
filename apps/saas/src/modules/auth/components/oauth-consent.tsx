"use client";

import { authClient } from "@fuutu/auth/client";
import type { McpConsentRequest } from "@fuutu/auth/mcp-consent";
import { config } from "@fuutu/config";
import { createLogger } from "@fuutu/logs";
import { AuthCard, Badge, Button } from "@fuutu/ui";
import { Check, KeyRound, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

const log = createLogger({ scope: "auth-oauth-consent" });

const KNOWN_SCOPES = ["openid", "profile", "email", "offline_access"] as const;
type KnownScope = (typeof KNOWN_SCOPES)[number];

const isKnownScope = (scope: string): scope is KnownScope =>
	(KNOWN_SCOPES as readonly string[]).includes(scope);

/**
 * OAuth consent for MCP clients (Claude, ChatGPT, Cursor, …). The request
 * details are resolved server-side (`getMcpConsentRequest`); the
 * oauth-provider client plugin forwards the signed query on
 * `oauth2.consent`, and the response redirects back to the client.
 */
export function OAuthConsent({
	request,
}: {
	request: McpConsentRequest | null;
}) {
	const t = useTranslations("auth.consent");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState(false);

	async function respond(accept: boolean) {
		setSubmitting(true);
		try {
			// On success the response is `{ redirect: true, url }` and the
			// auth client's redirect plugin navigates back to the client.
			const res = await authClient.oauth2.consent({ accept });
			if (res.error) {
				setError(true);
				setSubmitting(false);
			}
		} catch (e) {
			log.error("oauth consent failed", { err: e });
			setError(true);
			setSubmitting(false);
		}
	}

	if (!request || error) {
		return (
			<AuthCard title={t("errorTitle")}>
				<p className="text-center text-muted-foreground text-sm">
					{t("error")}
				</p>
			</AuthCard>
		);
	}

	const client = request.clientName ?? t("unknownClient");
	const appName = config.app.name;

	return (
		<AuthCard
			title={t("title", { client })}
			description={t("description", { client, appName })}
		>
			<div className="space-y-6">
				<div className="mx-auto flex size-12 items-center justify-center bg-primary/10 text-primary">
					<KeyRound className="size-6" />
				</div>

				{request.unverified && (
					<div
						className="space-y-1 border border-amber-500/40 bg-amber-500/10 p-3"
						data-testid="consent-unverified"
					>
						<Badge
							variant="outline"
							className="gap-1 border-amber-500/60 text-amber-700 dark:text-amber-400"
						>
							<ShieldAlert className="size-3" />
							{t("unverified")}
						</Badge>
						<p className="text-muted-foreground text-xs">
							{t("unverifiedHint")}
						</p>
					</div>
				)}

				<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
					<dt className="text-muted-foreground">{t("redirectsTo")}</dt>
					<dd
						className="break-all font-medium font-mono"
						data-testid="consent-redirect-host"
					>
						{request.redirectHost}
					</dd>
					{request.clientHost && (
						<>
							<dt className="text-muted-foreground">{t("website")}</dt>
							<dd className="break-all font-mono">{request.clientHost}</dd>
						</>
					)}
				</dl>

				<div className="space-y-1 text-sm">
					<p className="font-medium">
						{request.organizationName
							? t("statementOrg", {
									client,
									appName,
									organization: request.organizationName,
								})
							: t("statement", { client, appName })}
					</p>
					{request.scopes.includes("offline_access") && (
						<p className="text-muted-foreground">{t("offlineAccess")}</p>
					)}
				</div>

				{request.scopes.length > 0 && (
					<div className="space-y-3">
						<p className="font-medium text-sm">{t("requestedAccess")}</p>
						<ul className="space-y-2">
							{request.scopes.map((scope) => (
								<li key={scope} className="flex items-start gap-2 text-sm">
									<Check className="mt-0.5 size-4 shrink-0 text-primary" />
									<span>
										{isKnownScope(scope) ? t(`scopes.${scope}`) : scope}
									</span>
								</li>
							))}
						</ul>
					</div>
				)}
				<p className="text-muted-foreground text-xs">{t("notice")}</p>
				<div className="grid grid-cols-2 gap-3">
					<Button
						variant="outline"
						onClick={() => respond(false)}
						disabled={submitting}
					>
						{t("deny")}
					</Button>
					<Button onClick={() => respond(true)} disabled={submitting}>
						{submitting ? t("submitting") : t("allow")}
					</Button>
				</div>
			</div>
		</AuthCard>
	);
}
