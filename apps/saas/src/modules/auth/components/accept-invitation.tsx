"use client";

import { authClient } from "@fuutu/auth/client";
import { getSafeRedirect } from "@fuutu/auth/redirect";
import { createLogger } from "@fuutu/logs";
import { AreaIcon, AuthCard, Button } from "@fuutu/ui";
import { Building2, RotateCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

type InvitationData = {
	id: string;
	organizationName: string;
	organizationSlug: string;
	inviterEmail: string;
	role: string;
	status: string;
};

const log = createLogger({ scope: "auth-invitation" });

export function AcceptInvitation() {
	const t = useTranslations("auth.acceptInvitation");
	const router = useRouter();
	const searchParams = useSearchParams();
	const invitationId = searchParams.get("id");

	const [session, setSession] = useState<boolean | null>(null);
	const [invitation, setInvitation] = useState<InvitationData | null>(null);
	const [loading, setLoading] = useState(true);
	const [accepting, setAccepting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [sessionUnavailable, setSessionUnavailable] = useState(false);
	const [attempt, setAttempt] = useState(0);

	/**
	 * Only a successful answer without a session means "signed out". A failed
	 * check (rate limit, 5xx, network) must not send a signed-in user to
	 * sign-in — the server would bounce them straight back here, in a loop.
	 */
	const checkSession = useCallback(async (): Promise<
		"signed-in" | "signed-out" | "unavailable"
	> => {
		try {
			const res = await authClient.getSession();
			if (res.error) {
				log.warn("session check failed", { status: res.error.status });
				return "unavailable";
			}
			setSession(Boolean(res.data));
			return res.data ? "signed-in" : "signed-out";
		} catch (e) {
			log.warn("session check failed", { err: e });
			return "unavailable";
		}
	}, []);

	const loadInvitation = useCallback(async () => {
		if (!invitationId) {
			setLoading(false);
			return;
		}
		try {
			const res = await authClient.organization.getInvitation({
				query: { id: invitationId },
			});
			if (res.data) {
				setInvitation({
					id: res.data.id,
					organizationName: res.data.organizationName,
					organizationSlug: res.data.organizationSlug,
					inviterEmail: res.data.inviterEmail,
					role: res.data.role,
					status: res.data.status,
				});
			} else if (res.error) {
				setError(t("error"));
			}
		} catch (e) {
			log.error("failed to load invitation", { err: e });
			setError(t("error"));
		} finally {
			setLoading(false);
		}
	}, [invitationId, t]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the check on Try again
	useEffect(() => {
		void (async () => {
			const state = await checkSession();
			if (state === "unavailable") {
				setSessionUnavailable(true);
				setLoading(false);
				return;
			}
			setSessionUnavailable(false);
			if (state === "signed-out") {
				if (invitationId) {
					const redirectPath = `/auth/accept-invitation?id=${invitationId}`;
					const safeRedirect = getSafeRedirect(redirectPath);
					router.replace(
						`/auth/sign-in?redirect=${encodeURIComponent(safeRedirect)}`,
					);
				} else {
					router.replace("/auth/sign-in");
				}
				return;
			}
			await loadInvitation();
		})();
	}, [checkSession, loadInvitation, invitationId, router, attempt]);

	async function handleAccept() {
		if (!invitationId) return;
		setAccepting(true);
		setError(null);
		try {
			const res = await authClient.organization.acceptInvitation({
				invitationId,
			});
			if (res.error) {
				setError(t("error"));
				return;
			}
			setSuccess(true);
			const slug = invitation?.organizationSlug;
			if (slug) {
				router.push(`/organizations/${slug}/dashboard`);
				router.refresh();
			} else {
				router.push("/organizations");
				router.refresh();
			}
		} catch (e) {
			log.error("failed to accept invitation", { err: e });
			setError(t("error"));
		} finally {
			setAccepting(false);
		}
	}

	if (sessionUnavailable && !loading) {
		return (
			<AuthCard title={t("sessionErrorTitle")}>
				<div role="alert" className="flex flex-col gap-4">
					<p className="text-muted-foreground text-sm">{t("sessionError")}</p>
					<Button
						onClick={() => {
							setLoading(true);
							setAttempt((n) => n + 1);
						}}
						className="w-full"
					>
						<RotateCw />
						{t("retry")}
					</Button>
				</div>
			</AuthCard>
		);
	}

	if (loading || session === null) {
		return (
			<AuthCard title={t("loading")}>
				<p className="text-muted-foreground text-sm">{t("loading")}</p>
			</AuthCard>
		);
	}

	if (!invitationId) {
		return (
			<AuthCard title={t("errorTitle")}>
				<p className="text-muted-foreground text-sm">{t("missingId")}</p>
			</AuthCard>
		);
	}

	if (success) {
		return (
			<AuthCard title={t("success")}>
				<div className="flex flex-col gap-4">
					<AreaIcon area="users">
						<Building2 />
					</AreaIcon>
					<p className="text-muted-foreground text-sm">
						{t("successDescription")}
					</p>
				</div>
			</AuthCard>
		);
	}

	if (error && !invitation) {
		return (
			<AuthCard title={t("errorTitle")}>
				<p className="text-muted-foreground text-sm">{error}</p>
			</AuthCard>
		);
	}

	return (
		<AuthCard
			title={t("title")}
			description={t("description", {
				organization: invitation?.organizationName ?? "",
				inviter: invitation?.inviterEmail ?? "",
			})}
		>
			<div className="space-y-6">
				<AreaIcon area="users">
					<Building2 />
				</AreaIcon>
				{error && (
					<div className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
						{error}
					</div>
				)}
				<Button onClick={handleAccept} disabled={accepting} className="w-full">
					{accepting ? t("accepting") : t("acceptButton")}
				</Button>
			</div>
		</AuthCard>
	);
}
