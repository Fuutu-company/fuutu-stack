"use client";

import { authClient } from "@fuutu/auth/client";
import { createLogger } from "@fuutu/logs";
import { storageConfig } from "@fuutu/storage";
import { Button, Card, CardContent } from "@fuutu/ui";
import { slugify } from "@fuutu/utils";
import { Building2, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { orpc } from "@/utils/orpc";

const MAX_LOGO_SIZE = 5 * 1024 * 1024;

const log = createLogger({ scope: "org-logo-upload" });

type FullOrg = {
	id: string;
	name: string;
	slug: string;
	logo?: string | null;
};

export function OrgLogoUpload({ slug }: { slug: string }) {
	const t = useTranslations("organizations");
	const [org, setOrg] = useState<FullOrg | null>(null);
	const [uploading, setUploading] = useState(false);
	const [removing, setRemoving] = useState(false);
	const [status, setStatus] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const loadOrg = useCallback(async () => {
		try {
			const res = await authClient.organization.getFullOrganization({
				query: { organizationSlug: slug },
			});
			// Better Auth's getFullOrganization() returns a superset of FullOrg — narrowing is safe.
			const data = res.data as FullOrg | null;
			if (data) setOrg(data);
		} catch (e) {
			log.error("failed to load organization", { err: e });
		}
	}, [slug]);

	useEffect(() => {
		void loadOrg();
	}, [loadOrg]);

	async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file || !org) return;
		if (file.size > MAX_LOGO_SIZE) {
			setStatus(t("settings.logo.tooLarge"));
			return;
		}
		setUploading(true);
		setStatus(null);
		try {
			const key = slugify(file.name);
			const presigned = await orpc.storage.upload.createPresigned.call({
				bucket: storageConfig.buckets.organizationLogos,
				key,
				contentType: file.type,
				organizationId: org.id,
			});

			await fetch(presigned.url, {
				method: "PUT",
				body: file,
				headers: presigned.headers,
			});

			const logoUrl = `/image-proxy/organization-logos/${org.id}/${key}`;
			await authClient.organization.update({
				organizationId: org.id,
				data: { logo: logoUrl },
			});

			setStatus(t("settings.logo.saved"));
			await loadOrg();
		} catch (e) {
			log.error("logo upload failed", { err: e });
			setStatus(t("settings.logo.failed"));
		} finally {
			setUploading(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	}

	async function handleRemove() {
		if (!org?.logo) return;
		setRemoving(true);
		setStatus(null);
		try {
			await authClient.organization.update({
				organizationId: org.id,
				data: { logo: null },
			});
			setStatus(t("settings.logo.saved"));
			await loadOrg();
		} catch (e) {
			log.error("logo removal failed", { err: e });
			setStatus(t("settings.logo.failed"));
		} finally {
			setRemoving(false);
		}
	}

	if (!org) return null;

	return (
		<Card>
			<CardContent className="space-y-4 p-6 md:p-8">
				<div>
					<h3 className="font-semibold text-lg">{t("settings.logo.title")}</h3>
					<p className="text-muted-foreground text-sm">
						{t("settings.logo.description")}
					</p>
				</div>
				<div className="flex items-center gap-4">
					<div className="relative size-16 overflow-hidden rounded-lg border bg-muted">
						{org.logo ? (
							<Image
								src={org.logo}
								alt={org.name}
								fill
								unoptimized
								className="object-cover"
							/>
						) : (
							<Building2 className="size-8 text-muted-foreground" />
						)}
					</div>
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={uploading}
								onClick={() => fileInputRef.current?.click()}
							>
								<Upload className="size-4" />
								{uploading
									? t("settings.logo.uploading")
									: t("settings.logo.upload")}
							</Button>
							{org.logo && (
								<Button
									variant="ghost"
									size="sm"
									disabled={removing}
									onClick={handleRemove}
								>
									<Trash2 className="size-4" />
									{removing
										? t("settings.logo.removing")
										: t("settings.logo.remove")}
								</Button>
							)}
						</div>
						<p className="text-muted-foreground text-xs">
							{t("settings.logo.hint")}
						</p>
					</div>
				</div>
				{status && <p className="text-muted-foreground text-sm">{status}</p>}
				<input
					ref={fileInputRef}
					type="file"
					accept="image/png,image/jpeg,image/webp"
					className="hidden"
					onChange={handleUpload}
				/>
			</CardContent>
		</Card>
	);
}
