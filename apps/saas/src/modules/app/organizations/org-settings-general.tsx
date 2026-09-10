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
	Button,
	Card,
	CardContent,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
} from "@fuutu/ui";
import { Building2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { OrgLogoUpload } from "./components/org-logo-upload";

const log = createLogger({ scope: "org-settings" });

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

export function OrgSettingsGeneral({ slug }: { slug: string }) {
	const t = useTranslations();
	const { data: session } = authClient.useSession();
	const [org, setOrg] = useState<FullOrg | null>(null);
	const [loading, setLoading] = useState(true);
	const [name, setName] = useState("");
	const [saving, setSaving] = useState(false);
	const [status, setStatus] = useState<string | null>(null);

	const currentUserId = session?.user?.id;
	const currentUserRole = org?.members?.find(
		(m) => m.userId === currentUserId,
	)?.role;
	const canEdit = currentUserRole
		? hasOrgPermission(
				ac,
				toOrgRole(currentUserRole),
				PERMISSIONS.ORGANIZATION.UPDATE,
			)
		: false;

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await authClient.organization.getFullOrganization({
				query: { organizationSlug: slug },
			});
			// Better Auth's getFullOrganization() returns a superset of FullOrg — narrowing is safe.
			const data = res.data as FullOrg | null;
			if (data) {
				setOrg(data);
				setName(data.name);
			}
		} catch (e) {
			log.error("failed to load organization", { err: e });
		} finally {
			setLoading(false);
		}
	}, [slug]);

	useEffect(() => {
		void load();
	}, [load]);

	async function rename(e: React.FormEvent) {
		e.preventDefault();
		if (!org) return;
		setSaving(true);
		setStatus(null);
		try {
			const res = await authClient.organization.update({
				organizationId: org.id,
				data: { name },
			});
			setStatus(
				res.error ? t("organizations.settings.failed") : t("common.success"),
			);
			if (!res.error) await load();
		} catch (error) {
			log.error("organization rename failed", { err: error });
			toast.error(t("organizations.settings.failed"));
		} finally {
			setSaving(false);
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
			<div className="flex items-center gap-3">
				<div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
					<Building2 className="size-5" />
				</div>
				<div>
					<h1 className="font-bold text-3xl tracking-tight">{org.name}</h1>
					<p className="text-muted-foreground text-sm">/{org.slug}</p>
				</div>
			</div>

			<OrgLogoUpload slug={slug} />

			<Card>
				<CardContent className="p-6 md:p-8">
					<form onSubmit={rename} className="space-y-5">
						<div>
							<h3 className="font-semibold text-lg">
								{t("organizations.settings.general")}
							</h3>
							<p className="text-muted-foreground text-sm">
								{t("organizations.settings.generalDescription")}
							</p>
						</div>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="org-rename">
									{t("organizations.settings.name")}
								</FieldLabel>
								<Input
									id="org-rename"
									value={name}
									onChange={(e) => setName(e.target.value)}
									required
									disabled={!canEdit}
								/>
							</Field>
						</FieldGroup>
						{canEdit && (
							<div className="flex items-center gap-3">
								<Button type="submit" disabled={saving || !name.trim()}>
									{saving ? t("common.saving") : t("common.save")}
								</Button>
								{status && (
									<span className="text-muted-foreground text-sm">
										{status}
									</span>
								)}
							</div>
						)}
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
