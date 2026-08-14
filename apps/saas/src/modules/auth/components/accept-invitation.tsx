"use client";

import { authClient } from "@fuutu/auth/client";
import { getSafeRedirect } from "@fuutu/auth/redirect";
import { createLogger } from "@fuutu/logs";
import { AuthCard, Button } from "@fuutu/ui";
import { Building2 } from "lucide-react";
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

	const checkSession = useCallback(async () => {
		const res = await authClient.getSession();
		setSession(Boolean(res.data));
		return Boolean(res.data);
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

	useEffect(() => {
		void (async () => {
			const loggedIn = await checkSession();
			if (!loggedIn) {
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
	}, [checkSession, loadInvitation, invitationId, router]);

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

	if (loading || session === null) {
		return (
			<AuthCard title={t("loading")}>
				<p className="text-center text-muted-foreground text-sm">
					{t("loading")}
				</p>
			</AuthCard>
		);
	}

	if (!invitationId) {
		return (
			<AuthCard title={t("errorTitle")}>
				<p className="text-center text-muted-foreground text-sm">
					{t("missingId")}
				</p>
			</AuthCard>
		);
	}

	if (success) {
		return (
			<AuthCard title={t("success")}>
				<div className="flex flex-col gap-4 text-center">
					<div className="mx-auto flex size-12 items-center justify-center bg-primary/10 text-primary">
						<Building2 className="size-6" />
					</div>
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
				<p className="text-center text-muted-foreground text-sm">{error}</p>
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
				<div className="mx-auto flex size-12 items-center justify-center bg-primary/10 text-primary">
					<Building2 className="size-6" />
				</div>
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
