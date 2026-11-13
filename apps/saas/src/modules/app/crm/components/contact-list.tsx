"use client";

import { ContactStatusBadge } from "@app/crm/components/contact-status-badge";
import { AreaIcon, Button, Skeleton } from "@fuutu/ui";
import { Pencil, Trash2, Users } from "lucide-react";
import { useTranslations } from "next-intl";

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

type ContactListProps = {
	contacts: Contact[];
	loading: boolean;
	onEdit: (contact: Contact) => void;
	onDelete: (contact: Contact) => void;
	onNew?: () => void;
};

export function ContactList({
	contacts,
	loading,
	onEdit,
	onDelete,
	onNew,
}: ContactListProps) {
	const t = useTranslations("crm");

	if (loading) {
		return (
			<div className="space-y-2">
				{Array.from({ length: 5 }).map((_, i) => (
					<Skeleton key={i} className="h-14 w-full" />
				))}
			</div>
		);
	}

	if (contacts.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
				<AreaIcon area="users">
					<Users />
				</AreaIcon>
				<p className="text-muted-foreground text-sm">{t("emptyContacts")}</p>
				{onNew && <Button onClick={onNew}>{t("emptyContactsCta")}</Button>}
			</div>
		);
	}

	return (
		<div className="-mx-6 -mb-6 overflow-x-auto border-t">
			<table className="w-full text-sm">
				<thead className="bg-muted/50">
					<tr className="text-left">
						<th className="whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground text-xs">
							{t("name")}
						</th>
						<th className="whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground text-xs">
							{t("email")}
						</th>
						<th className="whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground text-xs">
							{t("company")}
						</th>
						<th className="whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground text-xs">
							{t("status")}
						</th>
						<th className="whitespace-nowrap px-4 py-3 text-right font-semibold text-muted-foreground text-xs">
							{t("actions")}
						</th>
					</tr>
				</thead>
				<tbody className="divide-y">
					{contacts.map((contact) => (
						<tr key={contact.id} className="hover:bg-muted/30">
							<td className="px-4 py-3">
								<div className="font-medium">{contact.name}</div>
								{contact.phone && (
									<div className="text-muted-foreground text-xs">
										{contact.phone}
									</div>
								)}
							</td>
							<td className="px-4 py-3 text-muted-foreground">
								{contact.email}
							</td>
							<td className="px-4 py-3 text-muted-foreground">
								{contact.company ?? t("notProvided")}
							</td>
							<td className="px-4 py-3">
								<ContactStatusBadge status={contact.status} />
							</td>
							<td className="px-4 py-3">
								<div className="flex justify-end gap-1">
									<Button
										size="sm"
										variant="ghost"
										onClick={() => onEdit(contact)}
										aria-label={t("editContactAria")}
										title={t("editContact")}
									>
										<Pencil className="size-4" />
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => onDelete(contact)}
										aria-label={t("deleteContactAria")}
										title={t("deleteContact")}
									>
										<Trash2 className="size-4 text-destructive" />
									</Button>
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
