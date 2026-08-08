"use client";

import { authClient } from "@fuutu/auth/client";
import { createLogger } from "@fuutu/logs";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Badge,
	Button,
	Card,
	CardContent,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@fuutu/ui";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Trash2, Webhook } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";
import { WebhookCreateDialog } from "./webhook-create-dialog";
import { WebhookDeliveries } from "./webhook-deliveries";
import { WebhookEditDialog } from "./webhook-edit-dialog";

type FullOrg = {
	id: string;
	name: string;
	slug: string;
};

type CreatedWebhook = {
	id: string;
	url: string;
	events: string[];
	secret: string;
	isActive: boolean;
	createdAt: Date;
};

const log = createLogger({ scope: "webhooks" });

export function WebhookList({ slug }: { slug: string }) {
	const t = useTranslations("webhooks");
	const tCommon = useTranslations("common");
	const [org, setOrg] = useState<FullOrg | null>(null);
	const [secretWebhook, setSecretWebhook] = useState<CreatedWebhook | null>(
		null,
	);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);

	const loadOrg = useCallback(async () => {
		const res = await authClient.organization.getFullOrganization({
			query: { organizationSlug: slug },
		});
		// Better Auth's getFullOrganization() returns a superset of FullOrg — narrowing is safe.
		const data = res.data as FullOrg | null;
		if (data) setOrg(data);
	}, [slug]);

	useEffect(() => {
		void loadOrg();
	}, [loadOrg]);

	const query = useQuery(
		orpc.webhooks.list.queryOptions({
			input: { organizationId: org?.id ?? "" },
			enabled: org !== null,
		}),
	);

	const items = query.data?.items ?? [];

	async function deleteWebhook() {
		if (!deleteId || !org) return;
		setDeleting(true);
		try {
			await orpc.webhooks.delete.call({
				id: deleteId,
				organizationId: org.id,
			});
			setDeleteId(null);
			void query.refetch();
		} catch (e) {
			log.error("webhook deletion failed", { err: e });
			toast.error(t("deleteError"));
		} finally {
			setDeleting(false);
		}
	}

	return (
		<div className="space-y-6">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="font-bold text-3xl tracking-tight">{t("title")}</h1>
					<p className="mt-2 text-muted-foreground text-sm">
						{t("description")}
					</p>
				</div>
				{org && (
					<WebhookCreateDialog
						organizationId={org.id}
						onCreated={(webhook) => {
							setSecretWebhook(webhook);
							void query.refetch();
						}}
					/>
				)}
			</div>

			{!org || query.isLoading ? (
				<p className="text-muted-foreground text-sm">{t("loading")}</p>
			) : query.isError ? (
				<p className="text-destructive text-sm">{t("failed")}</p>
			) : items.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
						<Webhook className="size-8 text-muted-foreground" />
						<p className="font-medium text-sm">{t("empty")}</p>
						<p className="text-muted-foreground text-sm">
							{t("emptyDescription")}
						</p>
						{org && (
							<WebhookCreateDialog
								organizationId={org.id}
								onCreated={(webhook) => {
									setSecretWebhook(webhook);
									void query.refetch();
								}}
							/>
						)}
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{items.map((webhook) => (
						<Card key={webhook.id}>
							<CardContent className="space-y-3 p-6">
								<div className="flex items-start justify-between gap-4">
									<div className="space-y-1">
										<p className="font-mono text-sm">{webhook.url}</p>
										<div className="flex flex-wrap gap-1">
											{webhook.events.map((event) => (
												<Badge
													key={event}
													variant="secondary"
													className="text-xs"
												>
													{t(`events.${event}`)}
												</Badge>
											))}
										</div>
										<p className="text-muted-foreground text-xs">
											{t("col.active")}: {webhook.isActive ? t("yes") : t("no")}
										</p>
									</div>
									<div className="flex items-center gap-1">
										<WebhookEditDialog
											webhook={webhook}
											organizationId={org.id}
											onUpdated={() => void query.refetch()}
										/>
										<Button
											variant="ghost"
											size="sm"
											aria-label={t("deleteAria")}
											onClick={() => setDeleteId(webhook.id)}
										>
											<Trash2 className="size-4" />
										</Button>
									</div>
								</div>
								<WebhookDeliveries
									webhookId={webhook.id}
									organizationId={org.id}
								/>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Secret dialog — shown once after creation */}
			<Dialog
				open={secretWebhook !== null}
				onOpenChange={(v) => {
					if (!v) setSecretWebhook(null);
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>{t("secretDialog.title")}</DialogTitle>
						<DialogDescription>
							{t("secretDialog.description")}
						</DialogDescription>
					</DialogHeader>
					<SecretField secret={secretWebhook?.secret ?? null} t={t} />
					<DialogFooter>
						<Button onClick={() => setSecretWebhook(null)}>
							{t("secretDialog.done")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete confirmation */}
			<AlertDialog
				open={deleteId !== null}
				onOpenChange={(v) => {
					if (!v) setDeleteId(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("deleteDialog.description")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
						<AlertDialogAction
							onClick={deleteWebhook}
							disabled={deleting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{t("deleteDialog.confirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function SecretField({
	secret,
	t,
}: {
	secret: string | null;
	t: ReturnType<typeof useTranslations>;
}) {
	const [copied, setCopied] = useState(false);

	async function copySecret() {
		if (!secret) return;
		await navigator.clipboard.writeText(secret);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	return (
		<div className="flex items-center gap-2 rounded-md border bg-muted p-3">
			<code className="flex-1 truncate font-mono text-sm">{secret}</code>
			<Button type="button" variant="outline" size="sm" onClick={copySecret}>
				{copied ? <Check className="size-4" /> : <Copy className="size-4" />}
				{copied ? t("secretDialog.copied") : t("secretDialog.copy")}
			</Button>
		</div>
	);
}
