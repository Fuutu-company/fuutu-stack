"use client";

import { authClient } from "@fuutu/auth/client";
import { createLogger } from "@fuutu/logs";
import {
	hasOrgPermission,
	ORG_POLICY,
	OrgAccessControl,
	PERMISSIONS,
	toOrgRole,
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
	PageHeader,
} from "@fuutu/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { orpc } from "@/utils/orpc";
import {
	useFullOrganization,
	useInvalidateOrganization,
} from "./use-full-organization";

const log = createLogger({ scope: "org-danger" });

const ac = new OrgAccessControl(ORG_POLICY);

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
	const orgQuery = useFullOrganization(slug);
	const invalidateOrganization = useInvalidateOrganization();
	// Better Auth's getFullOrganization() returns a superset of FullOrg — narrowing is safe.
	const org = (orgQuery.data ?? null) as FullOrg | null;
	const loading = orgQuery.isPending;
	const [busy, setBusy] = useState<string | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	const currentUserId = session?.user?.id;
	const currentUserRole = org?.members?.find(
		(m) => m.userId === currentUserId,
	)?.role;
	const isOwner = currentUserRole
		? hasOrgPermission(
				ac,
				toOrgRole(currentUserRole),
				PERMISSIONS.ORGANIZATION.DELETE,
			)
		: false;

	async function deleteOrg() {
		if (!org) return;
		setBusy("__delete__");
		setDeleteError(null);
		try {
			await orpc.organizations.delete.call({ organizationId: org.id });
			await invalidateOrganization(slug, { remove: true });
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
			<PageHeader
				variant="compact"
				title={t("organizations.settings.danger")}
			/>

			<Card className="bg-destructive/5 py-0 ring-destructive/30">
				<CardContent className="space-y-4 p-6 md:p-8">
					<div>
						<h3 className="font-bold font-heading text-destructive text-lg tracking-heading">
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
									<AlertDialogAction onClick={deleteOrg} variant="destructive">
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
