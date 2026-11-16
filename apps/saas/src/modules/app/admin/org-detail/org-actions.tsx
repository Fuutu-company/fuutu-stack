"use client";

import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Input,
	Label,
} from "@fuutu/ui";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { client } from "@/utils/orpc";
import { useAdminAction } from "../admin-action";
import {
	ActionDialog,
	isReasonValid,
	ReasonField,
} from "../user-detail/action-dialog";
import type { AdminOrganizationDetailData } from "./types";

type DialogKind = "rename" | "delete";

type DialogProps = {
	org: AdminOrganizationDetailData;
	onClose: () => void;
};

export function OrgActions({ org }: { org: AdminOrganizationDetailData }) {
	const t = useTranslations("admin.organizationDetail.actions");
	const [dialog, setDialog] = useState<DialogKind | null>(null);
	const close = () => setDialog(null);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline">
						{t("menu")}
						<ChevronDown aria-hidden="true" className="size-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-64">
					<DropdownMenuLabel>{t("menu")}</DropdownMenuLabel>
					<DropdownMenuItem onSelect={() => setDialog("rename")}>
						<Pencil />
						{t("rename")}
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						className="text-destructive focus:text-destructive"
						onSelect={() => setDialog("delete")}
					>
						<Trash2 />
						{t("delete")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			{dialog === "rename" ? <RenameDialog org={org} onClose={close} /> : null}
			{dialog === "delete" ? <DeleteDialog org={org} onClose={close} /> : null}
		</>
	);
}

function RenameDialog({ org, onClose }: DialogProps) {
	const t = useTranslations("admin.organizationDetail.dialog.rename");
	const [name, setName] = useState(org.name);
	const [reason, setReason] = useState("");
	const nameId = useId();
	const changed = name.trim() !== "" && name.trim() !== org.name;

	const mutation = useAdminAction({
		mutationFn: () =>
			client.admin.organizations.rename({
				organizationId: org.id,
				name: name.trim(),
				...(reason.trim() ? { reason: reason.trim() } : {}),
			}),
		successKey: "organizationDetail.toast.renamed",
		onSuccess: onClose,
	});

	return (
		<ActionDialog
			title={t("title")}
			description={t("description")}
			confirmLabel={t("confirm")}
			busy={mutation.isPending}
			canSubmit={changed && (reason.trim() === "" || isReasonValid(reason))}
			onConfirm={() => mutation.mutate(undefined)}
			onClose={onClose}
		>
			<div className="space-y-2">
				<Label htmlFor={nameId}>{t("name")}</Label>
				<Input
					id={nameId}
					value={name}
					maxLength={100}
					onChange={(e) => setName(e.target.value)}
				/>
			</div>
			<ReasonField value={reason} onChange={setReason} required={false} />
		</ActionDialog>
	);
}

function DeleteDialog({ org, onClose }: DialogProps) {
	const t = useTranslations("admin.organizationDetail.dialog.delete");
	const router = useRouter();
	const [reason, setReason] = useState("");
	const [confirmSlug, setConfirmSlug] = useState("");
	const confirmId = useId();
	const matches = confirmSlug.trim().toLowerCase() === org.slug.toLowerCase();

	const mutation = useAdminAction({
		mutationFn: () =>
			client.admin.organizations.delete({
				organizationId: org.id,
				reason: reason.trim(),
				confirmSlug: confirmSlug.trim(),
			}),
		successKey: "organizationDetail.toast.deleted",
		onSuccess: () => router.replace("/admin/organizations"),
	});

	return (
		<ActionDialog
			destructive
			title={t("title")}
			description={t("description", { name: org.name })}
			confirmLabel={t("confirm")}
			busy={mutation.isPending}
			canSubmit={matches && isReasonValid(reason)}
			onConfirm={() => mutation.mutate(undefined)}
			onClose={onClose}
		>
			<div className="space-y-2">
				<Label htmlFor={confirmId}>
					{t("confirmLabel", { slug: org.slug })}
				</Label>
				<Input
					id={confirmId}
					value={confirmSlug}
					autoComplete="off"
					onChange={(e) => setConfirmSlug(e.target.value)}
				/>
			</div>
			<ReasonField value={reason} onChange={setReason} />
		</ActionDialog>
	);
}
