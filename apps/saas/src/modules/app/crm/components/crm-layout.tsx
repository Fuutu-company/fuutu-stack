"use client";

import { ContactDeleteDialog } from "@app/crm/components/contact-delete-dialog";
import { ContactForm } from "@app/crm/components/contact-form";
import { ContactList } from "@app/crm/components/contact-list";
import type { ContactStatus } from "@app/crm/components/contact-status-badge";
import { authClient } from "@fuutu/auth/client";
import { createLogger } from "@fuutu/logs";
import { Button, Card, CardContent, Input } from "@fuutu/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { client, orpc } from "@/utils/orpc";

const log = createLogger({ scope: "crm-layout" });

type Contact = {
	id: string;
	name: string;
	email: string;
	company: string | null;
	phone: string | null;
	status: string;
	notes: string | null;
	createdAt: string | Date;
};

type Org = {
	id: string;
};

const fullOrgSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
});

type FullOrg = z.infer<typeof fullOrgSchema>;

type FormValues = {
	name: string;
	email: string;
	company: string;
	phone: string;
	status: string;
	notes: string;
};

export function CrmLayout({ slug }: { slug?: string } = {}) {
	const t = useTranslations("crm");
	const queryClient = useQueryClient();
	const { data: activeOrg } = authClient.useActiveOrganization();
	const [orgBySlug, setOrgBySlug] = useState<FullOrg | null>(null);

	const [orgError, setOrgError] = useState(false);

	const loadOrg = useCallback(async () => {
		if (!slug) return;
		try {
			const res = await authClient.organization.getFullOrganization({
				query: { organizationSlug: slug },
			});
			const parsed = fullOrgSchema.safeParse(res.data);
			if (parsed.success) {
				setOrgBySlug(parsed.data);
			} else {
				log.error("org lookup returned unexpected shape", { slug });
				setOrgError(true);
			}
		} catch (error) {
			log.error("org lookup failed", { slug, error });
			setOrgError(true);
		}
	}, [slug]);

	useEffect(() => {
		void loadOrg();
	}, [loadOrg]);

	// Better Auth's active organization type is a superset of Org (has id, name, slug, …).
	// Narrowing to Org | null is safe — we only read org.id.
	const org = (slug ? orgBySlug : (activeOrg as Org | null)) ?? null;
	const organizationId = org?.id ?? null;

	const [search, setSearch] = useState("");
	const [formOpen, setFormOpen] = useState(false);
	const [editingContact, setEditingContact] = useState<Contact | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);

	const listInput = {
		organizationId: organizationId ?? "",
		...(search ? { search } : {}),
	};

	const { data, isPending } = useQuery(
		orpc.crm.contacts.list.queryOptions({
			input: listInput,
			enabled: !!organizationId,
		}),
	);

	const contacts: Contact[] = data?.items ?? [];

	const createMutation = useMutation({
		mutationFn: async (values: FormValues) => {
			if (!organizationId) return;
			return client.crm.contacts.create({
				organizationId,
				name: values.name,
				email: values.email,
				company: values.company || undefined,
				phone: values.phone || undefined,
				// FormValues.status is string; the Select only offers ContactStatus values.
				status: values.status as ContactStatus,
				notes: values.notes || undefined,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.crm.contacts.list.key({ input: listInput }),
			});
			setFormOpen(false);
			toast.success(t("contactCreated"));
		},
		onError: (error) => {
			log.error("create contact failed", { error });
			toast.error(t("createError"));
		},
	});

	const updateMutation = useMutation({
		mutationFn: async (values: FormValues) => {
			if (!organizationId || !editingContact) return;
			return client.crm.contacts.update({
				id: editingContact.id,
				organizationId,
				name: values.name,
				email: values.email,
				company: values.company || undefined,
				phone: values.phone || undefined,
				// FormValues.status is string; the Select only offers ContactStatus values.
				status: values.status as ContactStatus,
				notes: values.notes || undefined,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.crm.contacts.list.key({ input: listInput }),
			});
			setFormOpen(false);
			setEditingContact(null);
			toast.success(t("contactUpdated"));
		},
		onError: (error) => {
			log.error("update contact failed", { error });
			toast.error(t("updateError"));
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async () => {
			if (!organizationId || !deleteTarget) return;
			return client.crm.contacts.delete({
				id: deleteTarget.id,
				organizationId,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.crm.contacts.list.key({ input: listInput }),
			});
			setDeleteTarget(null);
			toast.success(t("contactDeleted"));
		},
		onError: (error) => {
			log.error("delete contact failed", { error });
			toast.error(t("deleteError"));
		},
	});

	function handleNewContact() {
		setEditingContact(null);
		setFormOpen(true);
	}

	function handleEditContact(contact: Contact) {
		setEditingContact(contact);
		setFormOpen(true);
	}

	function handleFormSubmit(values: FormValues) {
		if (editingContact) {
			updateMutation.mutate(values);
		} else {
			createMutation.mutate(values);
		}
	}

	const isSubmitting = createMutation.isPending || updateMutation.isPending;

	if (!organizationId) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center">
				<p className="text-muted-foreground text-sm">
					{orgError ? t("loadOrgError") : t("noOrganization")}
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-end gap-4">
				<Button onClick={handleNewContact}>
					<Plus className="mr-2 size-4" />
					{t("newContact")}
				</Button>
			</div>

			<Card>
				<CardContent className="space-y-4 p-6">
					<div className="relative max-w-sm">
						<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={t("searchContacts")}
							className="pl-9"
						/>
					</div>

					{isPending ? (
						<p className="text-muted-foreground text-sm">
							{t("loadingContacts")}
						</p>
					) : (
						<ContactList
							contacts={contacts}
							loading={false}
							onEdit={handleEditContact}
							onDelete={(contact) => setDeleteTarget(contact)}
						/>
					)}
				</CardContent>
			</Card>

			<ContactForm
				open={formOpen}
				onOpenChange={setFormOpen}
				initialValues={
					editingContact
						? {
								name: editingContact.name,
								email: editingContact.email,
								company: editingContact.company ?? "",
								phone: editingContact.phone ?? "",
								status: editingContact.status,
								notes: editingContact.notes ?? "",
							}
						: null
				}
				onSubmit={handleFormSubmit}
				isSubmitting={isSubmitting}
			/>

			<ContactDeleteDialog
				open={!!deleteTarget}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null);
				}}
				onConfirm={() => deleteMutation.mutate()}
			/>
		</div>
	);
}
