"use client";

import { authClient } from "@fuutu/auth/client";
import { createLogger } from "@fuutu/logs";
import {
	AccessControl,
	DEFAULT_ACCESS_POLICY,
	hasPermission,
	toRbacRole,
} from "@fuutu/rbac";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
	Button,
	Card,
	CardContent,
} from "@fuutu/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

const log = createLogger({ scope: "org-danger" });

const ac = new AccessControl(DEFAULT_ACCESS_POLICY);

type Member = {
	id: string;
	userId: string;
	role: string;
};

type FullOrg = {
	id: string;
	name: string;
	slug: string;
	members?: Member[];
};

export function OrgSettingsDanger({ slug }: { slug: string }) {
	const t = useTranslations();
	const router = useRouter();
	const { data: session } = authClient.useSession();
	const [org, setOrg] = useState<FullOrg | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState<string | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	const currentUserId = session?.user?.id;
	const currentUserRole = org?.members?.find(
		(m) => m.userId === currentUserId,
	)?.role;
	const isOwner = currentUserRole
		? hasPermission(ac, toRbacRole(currentUserRole), "delete:organization")
		: false;

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await authClient.organization.getFullOrganization({
				query: { organizationSlug: slug },
			});
			// Better Auth's getFullOrganization() returns a superset of FullOrg — narrowing is safe.
			const data = res.data as FullOrg | null;
			if (data) setOrg(data);
		} finally {
			setLoading(false);
		}
	}, [slug]);

	useEffect(() => {
		void load();
	}, [load]);

	async function deleteOrg() {
		if (!org) return;
		setBusy("__delete__");
		setDeleteError(null);
		try {
			await authClient.organization.delete({ organizationId: org.id });
			router.push("/organizations");
			router.refresh();
		} catch (e) {
			log.error("deleteOrg failed", { err: e });
			setDeleteError(t("organizations.settings.failed"));
		} finally {
			setBusy(null);
		}
	}

	if (loading) {
		return (
			<p className="text-muted-foreground text-sm">{t("common.loading")}</p>
		);
	}
	if (!org) {
		return <p className="text-muted-foreground text-sm">{t("common.error")}</p>;
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-bold text-3xl text-destructive tracking-tight">
					{t("organizations.settings.danger")}
				</h1>
				<p className="mt-2 text-muted-foreground text-sm">
					{t("organizations.settings.dangerDescription")}
				</p>
			</div>

			<Card className="border-destructive/30 bg-destructive/5">
				<CardContent className="space-y-4 p-6 md:p-8">
					<div>
						<h3 className="font-semibold text-destructive text-lg">
							{t("organizations.settings.deleteOrg")}
						</h3>
						<p className="text-muted-foreground text-sm">
							{t("organizations.settings.deleteDescription")}
						</p>
					</div>
					{deleteError && (
						<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
							{deleteError}
						</div>
					)}
					{isOwner && (
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button variant="destructive" disabled={busy === "__delete__"}>
									{t("organizations.settings.deleteOrg")}
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>
										{t("organizations.settings.deleteTitle")}
									</AlertDialogTitle>
									<AlertDialogDescription>
										{t("organizations.settings.deleteDescription")}
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
									<AlertDialogAction
										onClick={deleteOrg}
										className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
									>
										{t("organizations.settings.deleteCta")}
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
